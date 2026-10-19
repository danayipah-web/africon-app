import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** Write a CSV to the cache and open the share sheet (the app's "Export CSV"). */
export async function shareCsv(fileName: string, csv: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    return;
  }
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  await file.write(csv);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: fileName, UTI: 'public.comma-separated-values-text' });
}

export function stamp(now = new Date()) {
  return now.toISOString().slice(0, 16).replace(/[:T]/g, '-');
}
