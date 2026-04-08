export interface Franchise {
  id: string;
  name: string;
  target: number;
  achievement: number;
  yesterdaySale: number;
  lastAddedAmount?: number;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalTarget: number;
  totalAchievement: number;
  totalYesterdaySale: number;
  achievementRate: number;
  remainingTarget: number;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}
