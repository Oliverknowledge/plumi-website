/**
 * A small LRU of baked chunks. `get(key)` returns the chunk, baking it with `make(key, recycled)` when absent; once `capacity` are held the
 * least recently used is evicted and handed to `make` to be repainted (so a canvas is reused, not reallocated). Keys used this frame are
 * the newest, so a frame that asks for no more than `capacity` chunks never evicts one it is still drawing.
 */
export class ChunkCache<T> {
  private map = new Map<number, T>();
  evictions = 0; bakes = 0;
  constructor(readonly capacity: number, private make: (key: number, recycled: T | null) => T) {}

  get size() { return this.map.size; }
  has(key: number) { return this.map.has(key); }
  keys(): number[] { return [...this.map.keys()]; }

  get(key: number): T {
    const hit = this.map.get(key);
    if (hit !== undefined) { this.map.delete(key); this.map.set(key, hit); return hit; }
    let recycled: T | null = null;
    if (this.map.size >= this.capacity) {
      const oldest = this.map.keys().next().value as number;
      recycled = this.map.get(oldest) as T;
      this.map.delete(oldest);
      this.evictions++;
    }
    const made = this.make(key, recycled);
    this.bakes++;
    this.map.set(key, made);
    return made;
  }
}
