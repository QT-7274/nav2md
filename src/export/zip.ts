import JSZip from "jszip";

export interface ZipFile {
  name: string;
  content: string;
}

export async function createZipBlob(files: ZipFile[]): Promise<Blob> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.name, file.content);
  }

  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: {
      level: 6
    }
  });
}
