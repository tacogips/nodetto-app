export class UnionFind {
  private readonly parent: number[];
  private readonly sizes: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.sizes = Array.from({ length: size }, () => 1);
  }

  find(i: number): number {
    let current = i;
    while (this.parent[current] !== current) {
      const parent = this.parent[current];
      if (parent === undefined)
        throw new RangeError("Invalid union-find index");
      const grandparent = this.parent[parent];
      if (grandparent === undefined)
        throw new RangeError("Invalid union-find index");
      this.parent[current] = grandparent;
      current = grandparent;
    }
    return current;
  }

  union(a: number, b: number): void {
    let rootA = this.find(a);
    let rootB = this.find(b);
    if (rootA === rootB) return;
    if ((this.sizes[rootA] ?? 0) < (this.sizes[rootB] ?? 0))
      [rootA, rootB] = [rootB, rootA];
    this.parent[rootB] = rootA;
    this.sizes[rootA] = (this.sizes[rootA] ?? 0) + (this.sizes[rootB] ?? 0);
  }
}
