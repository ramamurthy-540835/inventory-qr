FROM asia-south1-docker.pkg.dev/aidirac-503309/openclaw/cloud-run:latest

COPY start-cloud-run.sh /opt/openclaw/start-cloud-run-fixed.sh
COPY bridge.mjs /opt/openclaw/bridge.mjs
CMD ["sh", "/opt/openclaw/start-cloud-run-fixed.sh"]
