import { Package } from '../../domain/value-objects/Package';

/**
 * RegisterSystem Command
 * システム新規登録コマンド
 */
export class RegisterSystemCommand {
  constructor(
    public readonly name: string,
    public readonly type: string,
    public readonly host: {
      cpu: number;
      memory: number;
      storage: number;
      encryptionEnabled: boolean;
    },
    public readonly packages: Array<Package>,
    public readonly securityClassification: string,
    public readonly criticality: number,
    public readonly correlationId: string,
  ) {}
}
