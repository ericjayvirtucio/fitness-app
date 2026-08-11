const indentation = '  ';

type Frame = Readonly<{ kind: 'array' | 'object' }> & { hasEntries: boolean };

/**
 * Emits a JSON document one member at a time so a large export never holds a
 * second complete copy of itself as plain objects. Key order is whatever the
 * caller writes, which is how the export contract keeps a declared, stable
 * field order instead of relying on object property order.
 *
 * Invariants are enforced with thrown errors because reaching one is a
 * programming mistake in the serializer, not a user-recoverable condition.
 */
export class JsonDocumentWriter {
  private readonly chunks: string[] = [];
  private readonly stack: Frame[] = [];

  beginObject(): void {
    if (this.stack.length > 0) {
      throw new Error('The root object was already opened.');
    }
    this.chunks.push('{');
    this.stack.push({ hasEntries: false, kind: 'object' });
  }

  beginObjectMember(name: string): void {
    this.startEntry('object');
    this.chunks.push(`${JSON.stringify(name)}: {`);
    this.stack.push({ hasEntries: false, kind: 'object' });
  }

  beginArrayMember(name: string): void {
    this.startEntry('object');
    this.chunks.push(`${JSON.stringify(name)}: [`);
    this.stack.push({ hasEntries: false, kind: 'array' });
  }

  writeMember(name: string, value: unknown): void {
    this.startEntry('object');
    this.chunks.push(
      `${JSON.stringify(name)}: ${serialize(value, this.padding())}`,
    );
  }

  writeItem(value: unknown): void {
    this.startEntry('array');
    this.chunks.push(serialize(value, this.padding()));
  }

  end(): void {
    const frame = this.stack.pop();
    if (!frame) throw new Error('No open object or array to close.');
    if (frame.hasEntries) this.chunks.push(`\n${this.padding()}`);
    this.chunks.push(frame.kind === 'object' ? '}' : ']');
  }

  toText(): string {
    if (this.stack.length > 0) {
      throw new Error('The document has an unclosed object or array.');
    }
    return `${this.chunks.join('')}\n`;
  }

  private startEntry(expected: Frame['kind']): void {
    const frame = this.stack.at(-1);
    if (!frame) throw new Error('No open object or array to write into.');
    if (frame.kind !== expected) {
      throw new Error(`Expected an open ${expected}.`);
    }
    this.chunks.push(frame.hasEntries ? ',\n' : '\n');
    frame.hasEntries = true;
    this.chunks.push(this.padding());
  }

  private padding(): string {
    return indentation.repeat(this.stack.length);
  }
}

function serialize(value: unknown, padding: string): string {
  return JSON.stringify(value, null, 2).replaceAll('\n', `\n${padding}`);
}
