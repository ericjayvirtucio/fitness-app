import { isDataRestoreError } from './data-restore-error';
import type {
  DataRestoreFileSource,
  DataRestoreSelection,
} from './data-restore-file';
import { dataRestorePolicy } from './data-restore-policy';
import { SelectDataRestoreFileUseCase } from './select-data-restore-file-use-case';

class FakeFileSource implements DataRestoreFileSource {
  reads = 0;

  constructor(
    private readonly selection: DataRestoreSelection,
    private readonly text: string = '{}',
  ) {}

  pick(): Promise<DataRestoreSelection> {
    return Promise.resolve(this.selection);
  }

  readText(): Promise<string> {
    this.reads += 1;
    return Promise.resolve(this.text);
  }
}

const selected = (byteSize: number): DataRestoreSelection => ({
  file: { byteSize, uri: 'file:///synthetic/export.json' },
  status: 'selected',
});

async function expectFailure(
  work: Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(work).rejects.toThrow();
  await work.catch((error: unknown) => {
    expect(isDataRestoreError(error) && error.code).toBe(code);
  });
}

describe('SelectDataRestoreFileUseCase', () => {
  it('returns the contents of the selected file', async () => {
    const source = new FakeFileSource(selected(64), '{"format":"x"}');

    await expect(
      new SelectDataRestoreFileUseCase(source).execute(),
    ).resolves.toEqual({ status: 'selected', text: '{"format":"x"}' });
  });

  it('treats a dismissed picker as a neutral outcome', async () => {
    const source = new FakeFileSource({ status: 'cancelled' });

    await expect(
      new SelectDataRestoreFileUseCase(source).execute(),
    ).resolves.toEqual({ status: 'cancelled' });
    expect(source.reads).toBe(0);
  });

  it('refuses an oversized file without reading it', async () => {
    const source = new FakeFileSource(
      selected(dataRestorePolicy.maximumFileBytes + 1),
    );

    await expectFailure(
      new SelectDataRestoreFileUseCase(source).execute(),
      'file-too-large',
    );
    expect(source.reads).toBe(0);
  });

  it('refuses an empty file', async () => {
    await expectFailure(
      new SelectDataRestoreFileUseCase(
        new FakeFileSource(selected(0)),
      ).execute(),
      'file-empty',
    );
  });

  it('refuses a file whose contents are only whitespace', async () => {
    await expectFailure(
      new SelectDataRestoreFileUseCase(
        new FakeFileSource(selected(4), '   \n'),
      ).execute(),
      'file-empty',
    );
  });

  it('refuses contents that did not decode as text', async () => {
    await expectFailure(
      new SelectDataRestoreFileUseCase(
        new FakeFileSource(selected(8), '{"a":"�"}'),
      ).execute(),
      'invalid-encoding',
    );
  });

  it('reports an unavailable picker', async () => {
    const source: DataRestoreFileSource = {
      pick: () => Promise.reject(new Error('no picker')),
      readText: () => Promise.resolve(''),
    };

    await expectFailure(
      new SelectDataRestoreFileUseCase(source).execute(),
      'picker-unavailable',
    );
  });

  it('reports a file it could not read', async () => {
    const source: DataRestoreFileSource = {
      pick: () => Promise.resolve(selected(64)),
      readText: () => Promise.reject(new Error('permission denied')),
    };

    await expectFailure(
      new SelectDataRestoreFileUseCase(source).execute(),
      'file-unreadable',
    );
  });
});
