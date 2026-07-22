export const applyVisibility = (
  view: { setVisibility?: (visible: boolean) => void; visible?: boolean },
  visible: boolean | undefined,
): void => {
  if (visible === undefined) {
    return;
  }
  if (view.setVisibility) {
    view.setVisibility(visible);
  } else {
    view.visible = visible;
  }
};
