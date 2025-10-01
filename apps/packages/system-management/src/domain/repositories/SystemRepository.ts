import { System } from '../aggregates/System';
import { SystemId } from '../value-objects/SystemId';

/**
 * System Repository Interface
 * システムリポジトリインターフェイス（ドメイン層）
 */
export interface SystemRepository {
  /**
   * システムを保存
   */
  save(system: System): Promise<void>;

  /**
   * システムIDで検索
   */
  findById(systemId: SystemId): Promise<System | null>;

  /**
   * システム名で検索（一意制約）
   */
  findByName(name: string): Promise<System | null>;
}
