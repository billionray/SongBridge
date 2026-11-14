import {strToU8, unzipSync, zipSync, type Zippable} from 'fflate';

export function helperDownload(encoded: string, site: URL, hasConfiguredOrigin: boolean) {
  const archive = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  if (hasConfiguredOrigin || site.protocol !== 'https:') return archive;
  const files: Zippable = {};
  for (const [name, bytes] of Object.entries(unzipSync(archive))) {
    const contents = name === 'origins.mjs'
      ? strToU8('export const siteOrigins = ' + JSON.stringify([site.origin]) + ';\n')
      : bytes;
    const executable = name.endsWith('.command') || name.endsWith('.sh');
    files[name] = [contents, {os: 3, attrs: (executable ? 0o100755 : 0o100644) << 16}];
  }
  return zipSync(files, {level: 0});
}
