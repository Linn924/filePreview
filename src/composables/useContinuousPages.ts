import { ref, type Ref } from "vue";
/** Page controls only move the scroll position; native wheel behavior is untouched. */
export function useContinuousPages(
  scroll: Ref<HTMLElement | undefined>,
  elements: () => HTMLElement[],
) {
  const current = ref(1);
  function sync() {
    const root = scroll.value;
    if (!root) return;
    const pages = elements();
    const top =
      root.getBoundingClientRect().top + Math.min(100, root.clientHeight * 0.2);
    let index = 0;
    pages.forEach((page, i) => {
      if (page.getBoundingClientRect().top <= top) index = i;
    });
    current.value = index + 1;
  }
  function jump(value: number) {
    const pages = elements();
    const index = Math.max(
      0,
      Math.min(pages.length, Math.floor(value) || 1) - 1,
    );
    const target = pages[index];
    if (!target || !scroll.value) return;
    scroll.value.scrollTop +=
      target.getBoundingClientRect().top -
      scroll.value.getBoundingClientRect().top -
      24;
    current.value = index + 1;
  }
  return { current, sync, jump };
}
