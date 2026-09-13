(() => {
  "use strict";

  // Shared by every mode, including direct routes that never load the map.
  if (document.querySelector(".gaia-global-button-glint")) return;

  // Keep the highlight independent from each button's own pseudo-elements.
  // A single fixed layer also covers buttons created later by mode renderers.
  const buttonGlint = document.createElement("span");
  buttonGlint.className = "gaia-global-button-glint";
  buttonGlint.setAttribute("aria-hidden", "true");
  document.body.append(buttonGlint);

  let buttonGlintSource = null;
  let buttonGlintTarget = null;
  let buttonGlintPoint = null;
  let buttonGlintFrame = 0;

  const stopButtonGlint = () => {
    buttonGlint.classList.remove("is-active");
    buttonGlintSource = null;
    buttonGlintTarget = null;
    buttonGlintPoint = null;
    if (buttonGlintFrame) cancelAnimationFrame(buttonGlintFrame);
    buttonGlintFrame = 0;
  };

  const validateButtonGlint = () => {
    buttonGlintFrame = 0;
    const button = buttonGlintSource;
    const target = buttonGlintTarget;
    if (!button || !target || !buttonGlint.classList.contains("is-active")) return;
    const bounds = target.getBoundingClientRect();
    const glintBounds = buttonGlint.getBoundingClientRect();
    const visible = typeof button.checkVisibility === "function"
      ? button.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
      : button.isConnected && getComputedStyle(button).visibility !== "hidden";
    const topElement = buttonGlintPoint
      ? document.elementFromPoint(buttonGlintPoint.x, buttonGlintPoint.y)
      : button;
    const ownsPointer = !buttonGlintPoint || (topElement && button.contains(topElement));
    const sameBounds = Math.abs(bounds.left - glintBounds.left) < 1
      && Math.abs(bounds.top - glintBounds.top) < 1
      && Math.abs(bounds.width - glintBounds.width) < 1
      && Math.abs(bounds.height - glintBounds.height) < 1;
    if (!button.isConnected || !target.isConnected || button.disabled || !visible || !ownsPointer || !sameBounds) {
      stopButtonGlint();
      return;
    }
    buttonGlintFrame = requestAnimationFrame(validateButtonGlint);
  };

  const triggerButtonGlint = (button, point = null) => {
    if (
      !(button instanceof HTMLButtonElement)
      || button.disabled
      || button.matches(
        ".novel-interaction-open, #novel-log-close, .character-book-selector button, .character-book-expression-list button",
      )
    ) {
      stopButtonGlint();
      return;
    }

    const target = button.querySelector("[data-gaia-glint-surface]") || button;
    const bounds = target.getBoundingClientRect();
    if (bounds.width < 2 || bounds.height < 2) {
      stopButtonGlint();
      return;
    }

    const buttonStyle = getComputedStyle(button);
    const targetStyle = getComputedStyle(target);
    const colorVariables = [
      "--button-accent-rgb",
      "--intro-rgb",
      "--path-rgb",
      "--novel-rgb",
      "--space-rgb",
      "--space-accent-rgb",
      "--gx-rgb",
      "--accent-rgb",
      "--map-accent-rgb",
    ];
    const glintColor = colorVariables
      .map((property) => buttonStyle.getPropertyValue(property).trim())
      .find(Boolean) || "174, 231, 255";

    buttonGlint.style.left = `${bounds.left}px`;
    buttonGlint.style.top = `${bounds.top}px`;
    buttonGlint.style.width = `${bounds.width}px`;
    buttonGlint.style.height = `${bounds.height}px`;
    buttonGlint.style.borderRadius = targetStyle.borderRadius;
    buttonGlint.style.setProperty("--gaia-button-glint-rgb", glintColor);

    stopButtonGlint();
    buttonGlintSource = button;
    buttonGlintTarget = target;
    buttonGlintPoint = point;
    void buttonGlint.offsetWidth;
    buttonGlint.classList.add("is-active");
    buttonGlintFrame = requestAnimationFrame(validateButtonGlint);
  };

  document.addEventListener("pointerover", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (!button || (event.relatedTarget instanceof Node && button.contains(event.relatedTarget))) {
      return;
    }
    triggerButtonGlint(button, { x: event.clientX, y: event.clientY });
  });

  document.addEventListener("pointerout", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (button && button === buttonGlintSource && !(event.relatedTarget instanceof Node && button.contains(event.relatedTarget))) {
      stopButtonGlint();
    }
  });

  document.addEventListener("focusin", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (button) {
      triggerButtonGlint(button);
    }
  });

  // The fixed glint must not outlive a button that swaps the current view.
  // End it in the capture phase so navigation handlers cannot leave its frame
  // floating over the destination screen.
  document.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (button) {
      stopButtonGlint();
    }
  }, true);

  buttonGlint.addEventListener("animationend", (event) => {
    if (event.animationName === "gaia-button-glint-frame") {
      stopButtonGlint();
    }
  });
})();
