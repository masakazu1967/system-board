export interface KurrentConfig {
  connectionString?: string;
  nodes?: Array<{
    host: string;
    port: number;
  }>;
  credentials?: {
    username: string;
    password: string;
  };
  maxRetries?: number;
  retryDelay?: number;
  nodePreference?: 'leader' | 'follower' | 'random';
}

export const loadKurrentConfig = (): KurrentConfig => {
  const connectionString = process.env.KURRENT_DB_URL;
  const clusterNodes = process.env.KURRENT_CLUSTER_NODES;

  if (clusterNodes) {
    // クラスタ構成（本番・ステージング）
    const nodes = clusterNodes.split(',').map((node) => {
      const [host, port] = node.split(':');
      return {
        host,
        port: parseInt(port, 10) || 2113,
      };
    });

    return {
      nodes,
      credentials: {
        username: process.env.KURRENT_USERNAME || 'admin',
        password: process.env.KURRENT_PASSWORD || 'changeit',
      },
      maxRetries: 3,
      retryDelay: 1000,
      nodePreference: 'leader',
    };
  } else if (connectionString) {
    // 単一ノード構成（開発環境）
    return {
      connectionString,
      credentials: {
        username: process.env.KURRENT_USERNAME || 'admin',
        password: process.env.KURRENT_PASSWORD || 'changeit',
      },
      maxRetries: 1,
      retryDelay: 500,
      nodePreference: 'leader',
    };
  } else {
    throw new Error(
      'Either KURRENT_DB_URL or KURRENT_CLUSTER_NODES must be set',
    );
  }
};
