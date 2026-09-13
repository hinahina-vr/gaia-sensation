import { AuthenticatedUser, requireCsrf } from "./auth";
import { ApiError, json } from "./http";

type RelationshipKind = "FAVORITE" | "LIKE";

type SocialRow = {
  sensorId: string;
  favorite: number;
  liked: number;
};

type SensorSocialRow = SocialRow & {
  likeCount: number;
};

export const listSensorRelationships = async (env: Env, user: AuthenticatedUser): Promise<Response> => {
  const result = await env.DB.prepare(
    `SELECT d.public_id AS sensorId,
       MAX(CASE WHEN r.kind = 'FAVORITE' THEN 1 ELSE 0 END) AS favorite,
       MAX(CASE WHEN r.kind = 'LIKE' THEN 1 ELSE 0 END) AS liked
     FROM sensor_relationships r
     JOIN devices d ON d.id = r.device_id
     WHERE r.user_id = ?1 AND d.is_public = 1 AND d.status = 'ACTIVE' AND d.deleted_at IS NULL
     GROUP BY d.public_id
     ORDER BY MAX(r.created_at) DESC`,
  ).bind(user.id).all<SocialRow>();
  return json({
    sensors: result.results.map((row) => ({
      sensorId: row.sensorId,
      favorite: row.favorite === 1,
      liked: row.liked === 1,
    })),
  });
};

export const setSensorRelationship = async (
  request: Request,
  env: Env,
  user: AuthenticatedUser,
  sensorId: string,
  kind: RelationshipKind,
  enabled: boolean,
): Promise<Response> => {
  await requireCsrf(request, user);
  const sensor = await env.DB.prepare(
    `SELECT id FROM devices
     WHERE public_id = ?1 AND is_public = 1 AND status = 'ACTIVE' AND deleted_at IS NULL`,
  ).bind(sensorId).first<{ id: string }>();
  if (!sensor) throw new ApiError(404, "PUBLIC_SENSOR_NOT_FOUND", "Public sensor was not found.");
  if (enabled) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO sensor_relationships (user_id, device_id, kind, created_at)
       VALUES (?1, ?2, ?3, ?4)`,
    ).bind(user.id, sensor.id, kind, new Date().toISOString()).run();
  } else {
    await env.DB.prepare(
      "DELETE FROM sensor_relationships WHERE user_id = ?1 AND device_id = ?2 AND kind = ?3",
    ).bind(user.id, sensor.id, kind).run();
  }
  return json({ social: await sensorSocial(env, user.id, sensorId) });
};

const sensorSocial = async (env: Env, userId: string, sensorId: string): Promise<{
  sensorId: string;
  favorite: boolean;
  liked: boolean;
  likeCount: number;
}> => {
  const row = await env.DB.prepare(
    `SELECT d.public_id AS sensorId,
       EXISTS(
         SELECT 1 FROM sensor_relationships
         WHERE user_id = ?1 AND device_id = d.id AND kind = 'FAVORITE'
       ) AS favorite,
       EXISTS(
         SELECT 1 FROM sensor_relationships
         WHERE user_id = ?1 AND device_id = d.id AND kind = 'LIKE'
       ) AS liked,
       COALESCE(social.like_count, 0) AS likeCount
     FROM devices d
     LEFT JOIN device_social_rollups social ON social.device_id = d.id
     WHERE d.public_id = ?2 AND d.is_public = 1 AND d.status = 'ACTIVE' AND d.deleted_at IS NULL`,
  ).bind(userId, sensorId).first<SensorSocialRow>();
  if (!row) throw new ApiError(404, "PUBLIC_SENSOR_NOT_FOUND", "Public sensor was not found.");
  return {
    sensorId: row.sensorId,
    favorite: row.favorite === 1,
    liked: row.liked === 1,
    likeCount: Number(row.likeCount) || 0,
  };
};
