import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    // Resolve the image URL
    let finalUrl = imageUrl;

    // If it's a filename only, construct the full URL
    if (!imageUrl.startsWith('http')) {
      let path = imageUrl;
      
      // Normalize path
      if (path.startsWith('http')) {
        try {
          path = new URL(path).pathname;
        } catch {
          // keep original path
        }
      }
      
      path = path.replace(/^\/public\//, '/').replace(/^public\//, '');
      if (!path.startsWith('/')) path = `/${path}`;
      
      if (!path.includes('/completion_files/') && !path.includes('/attachments/')) {
        const cleanPath = path.replace(/^\/+/, '');
        path = `/completion_files/${cleanPath}`;
      }
      
      finalUrl = `https://service.dynacleanindustries.com${path}`;
    }

    console.log(`[Image Proxy] Fetching image from: ${finalUrl}`);

    // Fetch the image
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`[Image Proxy] Failed to fetch image: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status }
      );
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Return the image with proper CORS headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('[Image Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process image', details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
