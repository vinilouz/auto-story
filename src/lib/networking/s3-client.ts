export interface S3EditMetadata {
  name?: string;
  isPublic?: boolean;
  thumbnail?: string;
  note?: string;
}

export class S3Client {
  private static get baseUrl(): string {
    const url = process.env.S3_BASE_URL;
    if (!url) throw new Error('S3_BASE_URL is missing');
    return url;
  }

  private static get apiKey(): string {
    const key = process.env.S3_API_KEY;
    if (!key) throw new Error('S3_API_KEY is missing');
    return key;
  }

  static async register(): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/register`);
    if (!response.ok) throw new Error('Failed to register');
    return response;
  }

  static async getFiles(): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/files?key=${this.apiKey}`);
    if (!response.ok) throw new Error('Failed to get files');
    return response;
  }

  static async uploadFile(file: File | Blob, filename?: string): Promise<Response> {
    const formData = new FormData();
    if (filename) {
      formData.append('file', file, filename);
    } else {
      formData.append('file', file);
    }
    const response = await fetch(`${this.baseUrl}/upload?key=${this.apiKey}`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload file');
    return response;
  }

  static async remoteUpload(url: string, filename: string): Promise<Response> {
    const params = new URLSearchParams({
      key: this.apiKey,
      url,
      filename,
    });
    const response = await fetch(`${this.baseUrl}/remoteuploadurl?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to initiate remote upload');
    return response;
  }

  static async initiateChunkedUpload(filename: string): Promise<string> {
    const params = new URLSearchParams({
      key: this.apiKey,
      filename,
    });
    const response = await fetch(`${this.baseUrl}/initiateupload?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to initiate chunked upload');
    return response.text();
  }

  static async uploadChunk(sessionHash: string, chunk: File | Blob): Promise<Response> {
    const formData = new FormData();
    formData.append('file', chunk);
    const response = await fetch(`${this.baseUrl}/uploadchunk?session_hash=${sessionHash}`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload chunk');
    return response;
  }

  static async endChunkedUpload(sessionHash: string): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/endupload?session_hash=${sessionHash}`);
    if (!response.ok) throw new Error('Failed to end chunked upload');
    return response;
  }

  static async deleteFile(fileId: string): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/delete/${fileId}?key=${this.apiKey}`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to delete file');
    return response;
  }

  static async getEditPage(fileId: string): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/edit/${fileId}?key=${this.apiKey}`);
    if (!response.ok) throw new Error('Failed to get edit page');
    return response;
  }

  static async editFile(fileId: string, metadata: S3EditMetadata): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/editform/${fileId}?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });
    if (!response.ok) throw new Error('Failed to edit file');
    return response;
  }

  static async uploadBase64(base64Data: string): Promise<string> {
    if (base64Data.startsWith('http')) return base64Data;

    const matches = base64Data.match(/^data:(.+?);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 string format');
    }

    const mime = matches[1];
    const data = matches[2];
    const ext = mime.split('/')[1] || 'png';
    const fileName = `img-${Date.now()}.${ext}`;
    const buffer = Buffer.from(data, 'base64');
    const blob = new Blob([new Uint8Array(buffer)], { type: mime });

    const uploadResp = await this.uploadFile(blob, fileName);
    const htmlText = await uploadResp.text();
    const hrefMatch = htmlText.match(/href='([^']+)'/);

    if (hrefMatch && hrefMatch[1]) {
      const pageUrl = hrefMatch[1];
      const pageResp = await fetch(pageUrl);
      const pageHtml = await pageResp.text();
      const filenameMatch = pageHtml.match(/<h2[^>]*>([^<]+)<\/h2>/i);

      if (filenameMatch && filenameMatch[1]) {
        const finalFilename = filenameMatch[1].trim();
        return pageUrl.endsWith('/') ? `${pageUrl}${finalFilename}` : `${pageUrl}/${finalFilename}`;
      } else {
        return pageUrl.endsWith('/') ? `${pageUrl}${fileName}` : `${pageUrl}/${fileName}`;
      }
    }
    throw new Error('Failed to extract S3 URL from response');
  }
}
