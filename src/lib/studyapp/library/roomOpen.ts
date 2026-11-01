/** Whether the library page's room is open now (so the Desk's beacon stands aside: the page publishes more). */
let open = 0;
export const roomIsOpen = () => open > 0;
export function markRoom(on: boolean) { open = Math.max(0, open + (on ? 1 : -1)); }
