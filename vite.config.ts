import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { IncomingMessage } from 'node:http'

import { defineConfig, type Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import { nitro } from 'nitro/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Mirrors the /api rewrite in vercel.json (Vite never reads that file). Keep
// VITE_API_BASE_URL empty so the app stays same-origin and the session cookie
// stays first-party in dev.
const API_PROXY_TARGET = 'https://api.169.58.86.169.sslip.io'

function apiProxy(target: string): Plugin {
  const upstream = new URL(target)
  const isTls = upstream.protocol === 'https:'
  const send = (req: IncomingMessage) => ({
    protocol: upstream.protocol,
    hostname: upstream.hostname,
    port: upstream.port ? Number(upstream.port) : isTls ? 443 : 80,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: upstream.host },
  })

  return {
    // Vite's own server.proxy installs after TanStack Start's dev handler, so /api
    // would reach the router and 404; a pre-plugin claims the socket first.
    name: 'natlas-api-proxy',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api') || req.headers.upgrade) return next()
        const proxy = (isTls ? httpsRequest : httpRequest)(send(req), (upstreamRes) => {
          res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers)
          upstreamRes.pipe(res)
          upstreamRes.on('error', abort)
        })
        const abort = () => proxy.destroy()
        proxy.on('error', (error) => {
          server.config.logger.warn(`[api-proxy] ${req.method} ${req.url}: ${error.message}`)
          if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' })
          res.end(`N-ATLaS backend unreachable at ${target}`)
        })
        req.pipe(proxy)
        // A browser that navigates away mid-response aborts the socket; without
        // these the ECONNRESET/EPIPE surfaces as an unhandled 'error' event.
        req.on('error', abort)
        res.on('error', abort)
      })

      // The backend's realtime channel is websocket-only (engine.io long-polling
      // cannot pass through Fastify), so bridge the upgrade instead of faking it.
      server.httpServer?.on('upgrade', (req, client, head) => {
        if (!req.url?.startsWith('/api')) return
        const proxy = (isTls ? httpsRequest : httpRequest)(send(req))
        proxy.on('error', () => client.destroy())
        proxy.on('upgrade', (upstreamRes, socket, upstreamHead) => {
          const headers = Object.entries(upstreamRes.headers).map(
            ([name, value]) => `${name}: ${Array.isArray(value) ? value.join(', ') : value}`,
          )
          client.write(`HTTP/1.1 101 Switching Protocols\r\n${headers.join('\r\n')}\r\n\r\n`)
          if (head.length) socket.write(head)
          if (upstreamHead.length) client.write(upstreamHead)
          client.pipe(socket).pipe(client)
          client.on('error', () => socket.destroy())
          socket.on('error', () => client.destroy())
        })
        proxy.end()
      })
    },
  }
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [apiProxy(API_PROXY_TARGET), devtools(), tailwindcss(), tanstackStart(), nitro(), viteReact()],
})

export default config
