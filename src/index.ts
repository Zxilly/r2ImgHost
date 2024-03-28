import { IRequestStrict, Router } from 'itty-router';
import { fileTypeFromBuffer } from 'file-type';
import mime from 'mime/lite';
import { sha1Hex } from './utils';
import moment from 'moment/moment';

// declare what's available in our env
type Env = {
  IMG_BUCKET: R2Bucket;

  TOKEN: string | undefined;
}

// create a convenient duple
type CF = [env: Env, context: ExecutionContext]

// then pass them to the Router
const router = Router<IRequestStrict, CF>();

router.put('/:name', async (req, env) => {
  if (env.TOKEN) {
    const token = req.headers.get('Authorization');
    if (token !== env.TOKEN) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const name = req.params.name;
  const hash = await sha1Hex(name);

  let buf = await req.arrayBuffer();
  // throw error if more than 20mb
  if (buf.byteLength > 20 * 1024 * 1024) {
    return new Response('File too large', { status: 413 });
  }

  const mimes: string[] = [];

  let mimeType = req.headers.get('content-type');
  if (mimeType) {
    mimes.push(mimeType);
  }

  const typBuf = buf.slice(0, 1024);
  const typ = await fileTypeFromBuffer(typBuf);
  if (!typ) {
    return new Response('File type not recognized', { status: 400 });
  }
  mimes.push(typ.mime);

  const extTyp = mime.getType(name);
  if (!extTyp) {
    return new Response('Filename has no extension', { status: 400 });
  }
  mimes.push(extTyp);

  // mime should keep same
  if (mimes.some(m => m !== mimes[0])) {
    return new Response('File type mismatch', { status: 400 });
  }

  await env.IMG_BUCKET.put(hash, buf, {
    httpMetadata: {
      contentType: mimes[0],
      contentDisposition: `inline; filename="${name}"`
    }
  });

  const url = new URL(req.url);
  url.pathname = `/${hash}`;

  return new Response(url.toString(), { status: 201 });
});

router.get('/:hash', async (req, env) => {
  const hash = req.params.hash;

  if (hash.includes('.')) {
    const hex = await sha1Hex(hash);
    const url = new URL(req.url);
    url.pathname = `/${hex}`;
    return new Response(url.toString(), {
      status: 200, headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-store'
      }
    });
  }

  const object = await env.IMG_BUCKET.get(hash);

  if (!object) {
    return new Response(null, { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);

  const left = moment(object.uploaded).add(1, 'day').diff(moment(), 'seconds');
  if (left > 0) {
    headers.set('Cache-Control', `public, max-age=${left}`);
  } else {
    headers.set('Cache-Control', 'public, max-age=3600, must-revalidate');
  }

  return new Response(object.body, { headers });
});

router.get('/', async () => {
  return new Response(null, {
    status: 302,
    headers: {
      'Location': 'https://github.com/Zxilly/r2ImgHost'
    }
  });
});

router.all('*', async () => {
  return new Response('Not Found', { status: 404 });
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return router.handle(request, env, ctx);
  }
};
