module.exports = {
  apps: [
    {
      name: "gongchengliang001",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3001",
      cwd: "/opt/gongchengliang001",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
