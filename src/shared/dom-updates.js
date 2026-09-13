// Read the current DOM instead of retaining a shadow cache, so updates made by
// accessibility controls or other view owners are never masked by stale state.
export function setAttributeIfChanged(element, name, value) {
  const text = String(value);
  if (element.getAttribute(name) !== text) element.setAttribute(name, text);
}

export function setTextIfChanged(element, value) {
  const text = String(value);
  if (element.textContent !== text) element.textContent = text;
}

export function setStyleIfChanged(element, name, value) {
  if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
}
