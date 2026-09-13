"""Remove ImageGen's baked checkerboard while preserving enclosed pale artwork."""

from collections import deque
from pathlib import Path
import argparse

from PIL import Image
import numpy as np


def remove_checkerboard(source: Path, target: Path, vertical_padding: int | None = None,
                        blue_silhouette: bool = False) -> None:
    rgb = np.asarray(Image.open(source).convert("RGB"))
    height, width, _ = rgb.shape

    channel_spread = rgb.max(axis=2) - rgb.min(axis=2)
    brightness = rgb.min(axis=2)
    background_like = (channel_spread <= 10) & (brightness >= 232)

    exterior = np.zeros((height, width), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    def seed(y: int, x: int) -> None:
        if background_like[y, x] and not exterior[y, x]:
            exterior[y, x] = True
            queue.append((y, x))

    for x in range(width):
        seed(0, x)
        seed(height - 1, x)
    for y in range(height):
        seed(y, 0)
        seed(y, width - 1)

    while queue:
        y, x = queue.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < height and 0 <= nx < width:
                if background_like[ny, nx] and not exterior[ny, nx]:
                    exterior[ny, nx] = True
                    queue.append((ny, nx))

    alpha = np.full((height, width), 255, dtype=np.uint8)
    alpha[exterior] = 0

    # Remove the remaining pale fringe immediately adjacent to true transparency.
    fringe_like = (channel_spread <= 18) & (brightness >= 222)
    for _ in range(2):
        adjacent = np.zeros_like(exterior)
        adjacent[1:] |= exterior[:-1]
        adjacent[:-1] |= exterior[1:]
        adjacent[:, 1:] |= exterior[:, :-1]
        adjacent[:, :-1] |= exterior[:, 1:]
        new_fringe = adjacent & fringe_like & ~exterior
        exterior |= new_fringe
        alpha[new_fringe] = 0

    rgba = np.dstack((rgb, alpha))
    result = Image.fromarray(rgba, "RGBA")
    if vertical_padding is not None:
        if vertical_padding < 0:
            raise ValueError("vertical padding must be nonnegative")
        bounds = result.getchannel("A").getbbox()
        if bounds:
            # Trim empty top/bottom only: no scaling, reshaping or recoloring.
            result = result.crop((0, max(0, bounds[1] - vertical_padding), width,
                                  min(height, bounds[3] + vertical_padding)))
    if blue_silhouette:
        # This monochrome sprite contains no white artwork. Remove baked
        # neutral matte trapped inside fine hair loops as well as outer fringe.
        # Only alpha changes; retain every RGB value from the generated image.
        pixels = np.asarray(result).copy()
        colors = pixels[:, :, :3]
        neutral_matte = ((colors.max(axis=2) - colors.min(axis=2) <= 22)
                         & (colors.min(axis=2) >= 180))
        pixels[neutral_matte, 3] = 0
        result = Image.fromarray(pixels, "RGBA")
    result.save(target, optimize=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    parser.add_argument("--vertical-padding", type=int)
    parser.add_argument("--blue-silhouette", action="store_true")
    args = parser.parse_args()
    remove_checkerboard(args.source, args.target, args.vertical_padding, args.blue_silhouette)
