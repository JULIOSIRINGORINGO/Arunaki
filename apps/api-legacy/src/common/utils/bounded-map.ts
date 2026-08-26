export class BoundedMap<K, V> extends Map<K, V> {
  constructor(private readonly maxSize: number) {
    super();
  }

  set(key: K, value: V): this {
    super.set(key, value);
    if (this.size > this.maxSize) {
      // Map iteration returns keys in insertion order.
      // Therefore, the first key is the oldest.
      const oldestKey = this.keys().next().value;
      if (oldestKey !== undefined) {
        this.delete(oldestKey);
      }
    }
    return this;
  }
}
