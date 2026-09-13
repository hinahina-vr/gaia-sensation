// Owner requests: start at 13:00 (09-11), close at 16:00 without a clock jump (09-12).
// Preserve the submitted/frozen manuscripts; this authored revision changes only
// current clock metadata. The evening walk stays at 17:10–17:45.
export const afternoonClockRevisionId = 'afternoon-close-1600-20260912';
export const sceneClockChanges = Object.freeze([
  {
    "id": "festival_concept",
    "before": "AM 9:20–9:40",
    "after": "13:00–13:40"
  },
  {
    "id": "map_mode01",
    "before": "AM 9:40–9:45",
    "after": "13:40–14:20"
  },
  {
    "id": "gx_experience",
    "before": "AM 9:45–9:53",
    "after": "14:20–15:00"
  },
  {
    "id": "esp32_pitch",
    "before": "AM 9:53–10:00",
    "after": "15:00–15:30"
  },
  {
    "id": "circle_invitation",
    "before": "AM 10:00–10:07",
    "after": "15:30–15:40"
  },
  {
    "id": "welcome_chat",
    "before": "AM 10:07–10:45",
    "after": "15:40–17:45",
    "locationBefore": "学内チャット「惑星の放課後」／午前展示枠終了後の海側広場",
    "locationAfter": "学内チャット「惑星の放課後」／展示ブースから海沿いの帰り道"
  }
].map(Object.freeze));
export const chatClockChanges = Object.freeze([
  {
    "id": "welcome_chat_004",
    "before": "10:06",
    "after": "15:40"
  },
  {
    "id": "welcome_chat_006",
    "before": "10:06",
    "after": "15:40"
  },
  {
    "id": "welcome_chat_007",
    "before": "10:07",
    "after": "15:41"
  },
  {
    "id": "welcome_chat_008",
    "before": "10:07",
    "after": "15:41"
  },
  {
    "id": "welcome_chat_new_004",
    "before": "10:08",
    "after": "15:42"
  },
  {
    "id": "welcome_chat_011",
    "before": "10:08",
    "after": "15:42",
    "runtimeOnly": true
  },
  {
    "id": "welcome_chat_016",
    "before": "10:14",
    "after": "15:48"
  },
  {
    "id": "welcome_chat_new_006",
    "before": "10:14",
    "after": "15:48"
  },
  {
    "id": "welcome_chat_018",
    "before": "10:15",
    "after": "15:49"
  },
  {
    "id": "welcome_chat_021",
    "before": "10:17",
    "after": "15:51"
  },
  {
    "id": "welcome_chat_022",
    "before": "10:17",
    "after": "15:51"
  },
  {
    "id": "welcome_chat_023",
    "before": "10:18",
    "after": "15:52"
  },
  {
    "id": "welcome_chat_024",
    "before": "10:19",
    "after": "15:53"
  },
  {
    "id": "welcome_chat_025",
    "before": "10:19",
    "after": "15:53"
  },
  {
    "id": "welcome_chat_026",
    "before": "10:20",
    "after": "15:54"
  },
  {
    "id": "welcome_chat_027",
    "before": "10:20",
    "after": "15:54"
  },
  {
    "id": "welcome_chat_028",
    "before": "10:21",
    "after": "15:55"
  },
  {
    "id": "welcome_chat_029",
    "before": "10:21",
    "after": "15:55"
  },
  {
    "id": "welcome_chat_030",
    "before": "10:21",
    "after": "15:55"
  },
  {
    "id": "welcome_chat_new_009",
    "before": "10:22",
    "after": "15:56"
  },
  {
    "id": "welcome_chat_033",
    "before": "10:22",
    "after": "15:56"
  },
  {
    "id": "welcome_chat_035",
    "before": "10:23",
    "after": "15:57"
  },
  {
    "id": "welcome_chat_036",
    "before": "10:23",
    "after": "15:57"
  },
  {
    "id": "welcome_chat_037",
    "before": "10:23",
    "after": "15:57"
  },
  {
    "id": "welcome_chat_038",
    "before": "10:23",
    "after": "15:57"
  },
  {
    "id": "welcome_chat_039",
    "before": "10:24",
    "after": "15:58"
  },
  {
    "id": "welcome_chat_040",
    "before": "10:25",
    "after": "15:59"
  },
  {
    "id": "welcome_chat_081",
    "before": "10:41",
    "after": "17:41"
  },
  {
    "id": "welcome_chat_082",
    "before": "10:42",
    "after": "17:42"
  },
  {
    "id": "welcome_chat_083",
    "before": "10:42",
    "after": "17:42"
  },
  {
    "id": "welcome_chat_new_024",
    "before": "10:43",
    "after": "17:43"
  }
].map(Object.freeze));

export function applyAfternoonClock(input, {reverse = false} = {}) {
  const scenes = structuredClone(input);
  const from = reverse ? 'after' : 'before', to = reverse ? 'before' : 'after';
  for (const change of sceneClockChanges) {
    const scene = scenes.find(candidate => candidate.id === change.id);
    if (!scene) throw new Error('Missing clock revision scene: ' + change.id);
    if (scene.time !== change[from]) throw new Error('Unexpected clock revision input: ' + change.id + ' / ' + scene.time);
    scene.time = change[to];
    if (change.locationBefore) {
      const expected = reverse ? change.locationAfter : change.locationBefore;
      if (scene.location !== expected) throw new Error('Unexpected clock revision location: ' + change.id);
      scene.location = reverse ? change.locationBefore : change.locationAfter;
    }
    if (scene.temporal) {
      scene.temporal.time = scene.time;
      scene.temporal.location = scene.location;
      scene.temporal.displayTitle = scene.date + ' ' + scene.time + '｜' + scene.location;
    }
  }
  const entries = scenes.flatMap(scene => scene.steps || scene.entries || []);
  if (entries.length) {
    for (const change of chatClockChanges) {
      if (change.runtimeOnly && !scenes.some(scene => Array.isArray(scene.steps))) continue;
      const entry = entries.find(candidate => candidate.id === change.id);
      if (!entry || entry.time !== change[from]) throw new Error('Unexpected chat clock revision input: ' + change.id);
      entry.time = change[to];
    }
  }
  for (const scene of scenes) {
    if (!scene.steps?.length) continue;
    if (reverse) {
      scene.steps.forEach(step => { delete step.displayTime; });
      continue;
    }
    const minute = time => { const [h,m] = time.split(':').map(Number); return h*60+m; };
    const format = value => `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
    const [start,end] = scene.time.split('–').map(minute);
    const anchors = new Map([[0,start],[scene.steps.length-1,end]]);
    const milestones = {welcome_chat_047:'16:00',welcome_chat_064:'16:30',welcome_chat_073:'17:00',welcome_chat_075:'17:10'};
    scene.steps.forEach((step,index) => {
      const time = milestones[step.id] || step.time;
      if (time) anchors.set(index,minute(time));
    });
    const points = [...anchors].sort((a,b)=>a[0]-b[0]);
    for (let segment=0;segment<points.length-1;segment++) {
      const [a,from] = points[segment], [b,to] = points[segment+1];
      if (to<from) throw new Error(`Backwards authored clock: ${scene.steps[b].id}`);
      for(let index=a;index<=b;index++) scene.steps[index].displayTime = format(Math.round(from+(to-from)*(index-a)/(b-a)));
    }
  }
  return scenes;
}
