FROM directus/directus:11.5.0

USER root
COPY schema/ ./schema/
USER node

EXPOSE 8055
CMD ["directus", "start"]
