from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
VISUALS = ROOT / "assets" / "visuals-07"


def convert_background(source: Path) -> None:
    with Image.open(source) as image:
        image = image.convert("RGB")
        destination = source.with_suffix(".webp")
        image.save(destination, "WEBP", quality=84, method=6)
        print(f"{source.name}: {image.width}x{image.height} -> {destination.name}")


def inspect_alpha(source: Path) -> None:
    with Image.open(source) as image:
        if image.mode != "RGBA":
            raise ValueError(f"{source.name} is {image.mode}, expected RGBA")
        alpha = image.getchannel("A")
        if alpha.getextrema() != (0, 255):
            raise ValueError(f"{source.name} does not contain a complete alpha range")
        print(f"{source.name}: {image.width}x{image.height}, alpha={alpha.getextrema()}")


def main() -> None:
    for source in sorted(VISUALS.glob("*.png")):
        convert_background(source)

    characters = ROOT / "assets" / "characters"
    inspect_alpha(characters / "minamo-expression-sheet-07-alpha.png")
    inspect_alpha(characters / "sora-expression-sheet-07-alpha.png")


if __name__ == "__main__":
    main()
