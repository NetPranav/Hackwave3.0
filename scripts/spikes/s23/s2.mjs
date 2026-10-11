import { BatchInterceptor } from '@mswjs/interceptors';
import { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest';
import { FetchInterceptor } from '@mswjs/interceptors/fetch';
import http from 'node:http';
import axios from 'axios';

const srv = http.createServer((q, r) => { r.setHeader('content-type', 'application/json'); r.end(JSON.stringify({ email: 'a@b.c', n: 5 })); }).listen(0);
const base = `http://localhost:${srv.address().port}`;
const seen = [];
const i = new BatchInterceptor({ name: 's2', interceptors: [new ClientRequestInterceptor(), new FetchInterceptor()] });
i.apply();
i.on('response', async ({ response, request }) => { seen.push({ url: request.url, body: await response.clone().text() }); });
const f = await (await fetch(base + '/f')).json();
const a = (await axios.get(base + '/a')).data;
await new Promise((r) => setTimeout(r, 200));
console.log('app fetch body ok:', JSON.stringify(f), '| axios body ok:', JSON.stringify(a));
console.log('interceptor saw:', seen.length, 'bodies', seen.map((s) => s.body));
i.dispose(); srv.close();
