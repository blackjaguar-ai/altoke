FROM node:22-alpine3.24 AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install

FROM node:22-alpine3.24 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# El proyecto no tiene carpeta public/ (sin assets estaticos propios).
# La garantizamos vacia para que el COPY de la etapa run no falle.
RUN mkdir -p public
RUN npm run build

FROM node:22-alpine3.24 AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000
# CRITICO: Docker exporta $HOSTNAME = id del contenedor. El server.js que
# genera `output: "standalone"` usa process.env.HOSTNAME como interfaz de
# bind. Sin esto, el server escucha SOLO en la IP de la primera red docker
# adjunta (aqui: "interna") y queda inalcanzable desde cualquier otra red
# (como escai-network, donde vive nginx) -> "connection refused".
ENV HOSTNAME="0.0.0.0"
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# Directorio donde vive el volumen `uploads` (docker-compose.yml). Se crea
# acá para que exista con el owner correcto antes de que el volumen se
# monte encima - Docker lo crea igual si falta, pero como root, y el
# proceso Node corre como el user por defecto de la imagen; mejor no
# depender de esa carrera.
RUN mkdir -p uploads
EXPOSE 3000
CMD ["node","server.js"]