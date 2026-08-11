import type {
  DataExportFile,
  DataExportShareService,
} from './data-export-file';
import { ShareDataExportUseCase } from './share-data-export-use-case';

const file: DataExportFile = {
  byteSize: 1_024,
  fileName: 'fitness-app-export-20260811T091504Z.json',
  uri: 'file:///cache/data-export/fitness-app-export-20260811T091504Z.json',
};

class FakeShareService implements DataExportShareService {
  available = true;
  availabilityError: Error | undefined;
  shareError: Error | undefined;
  shared: DataExportFile | undefined;

  isAvailable(): Promise<boolean> {
    return this.availabilityError
      ? Promise.reject(this.availabilityError)
      : Promise.resolve(this.available);
  }

  share(target: DataExportFile): Promise<void> {
    if (this.shareError) return Promise.reject(this.shareError);
    this.shared = target;
    return Promise.resolve();
  }
}

describe('ShareDataExportUseCase', () => {
  it('hands the file to the platform when sharing is available', async () => {
    const shareService = new FakeShareService();

    await new ShareDataExportUseCase(shareService).execute(file);

    expect(shareService.shared).toEqual(file);
  });

  it('reports that the device cannot share', async () => {
    const shareService = new FakeShareService();
    shareService.available = false;

    await expect(
      new ShareDataExportUseCase(shareService).execute(file),
    ).rejects.toMatchObject({ code: 'sharing-unavailable' });
    expect(shareService.shared).toBeUndefined();
  });

  it('treats an availability check failure as unavailable', async () => {
    const shareService = new FakeShareService();
    shareService.availabilityError = new Error('module missing');

    await expect(
      new ShareDataExportUseCase(shareService).execute(file),
    ).rejects.toMatchObject({ code: 'sharing-unavailable' });
  });

  it('reports a sharing failure without discarding the export', async () => {
    const shareService = new FakeShareService();
    shareService.shareError = new Error('activity failed');

    await expect(
      new ShareDataExportUseCase(shareService).execute(file),
    ).rejects.toMatchObject({ code: 'sharing-failed' });
  });

  it('exposes no file path in a failure message', async () => {
    const shareService = new FakeShareService();
    shareService.available = false;

    await expect(
      new ShareDataExportUseCase(shareService).execute(file),
    ).rejects.toThrow('This device cannot open share or save options.');
  });
});
