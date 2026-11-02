FROM node:22-bookworm-slim AS builder
WORKDIR /build
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv libreoffice-writer libreoffice-calc fonts-liberation fonts-dejavu-core ca-certificates && rm -rf /var/lib/apt/lists/*
COPY scripts/pdf2docx-requirements.txt /tmp/pdf2docx-requirements.txt
RUN python3 -m venv /opt/pdf2docx-venv && /opt/pdf2docx-venv/bin/pip install --no-cache-dir -r /tmp/pdf2docx-requirements.txt
RUN /opt/pdf2docx-venv/bin/python -c "import pdf2docx, fitz, docx, cv2, numpy; print('PDF2DOCX_RUNTIME_OK', fitz.VersionBind, cv2.__version__, numpy.__version__)"
WORKDIR /opt/edms
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 STORAGE_ROOT=/app/storage PYTHON_BIN=python3 PDF2DOCX_PYTHON=/opt/pdf2docx-venv/bin/python
COPY --from=builder /build/.next/standalone ./
COPY --from=builder /build/.next/static ./.next/static
COPY --from=builder /build/public ./public
COPY --from=builder /build/src/lib ./src/lib
COPY --from=builder /build/scripts ./scripts
COPY --from=builder /build/sql ./sql
RUN mkdir -p /app/storage && chown -R node:node /app/storage /opt/edms
USER node
RUN node scripts/check-runtime.mjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=8s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/v2/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","scripts/start.mjs"]
