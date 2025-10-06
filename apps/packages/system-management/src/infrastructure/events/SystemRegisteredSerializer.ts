import { EventSerializer } from '@system-board/shared';
import { z } from 'zod';
import { SystemRegisteredData } from '../../domain/events/SystemRegisteredData';
import { CriticalityLevel } from '../../domain/value-objects/CriticalityLevel';
import { VulnerabilityInfo } from '../../domain/value-objects/Package';

// Zodスキーマで型安全にデシリアライズ
const VulnerabilityInfoDataSchema = z.object({
  cveId: z.string(),
  severity: z.string(),
  cvssScore: z.number(),
});

const PackageDataSchema = z.object({
  name: z.string(),
  version: z.string(),
  dependencies: z.array(z.string()),
  vulnerabilities: z.array(VulnerabilityInfoDataSchema),
});

const HostDataSchema = z.object({
  cpu: z.number(),
  memory: z.number(),
  storage: z.number(),
  encryptionEnabled: z.boolean(),
});

const SystemRegisteredDataSchema = z.object({
  systemId: z.string(),
  name: z.string(),
  type: z.string(),
  host: HostDataSchema,
  criticality: z.number(),
  packages: z.array(PackageDataSchema),
  securityClassification: z.string(),
});

export class SystemRegisteredSerializer
  implements EventSerializer<SystemRegisteredData>
{
  serialize(data: SystemRegisteredData): Record<string, unknown> {
    return {
      systemId: data.systemId,
      name: data.name,
      type: data.type,
      host: {
        cpu: data.host.cpu,
        memory: data.host.memory,
        storage: data.host.storage,
        encryptionEnabled: data.host.encryptionEnabled,
      },
      criticality: data.criticality.getValue(),
      packages: data.packages.map((p) => ({
        name: p.name,
        version: p.version,
        dependencies: p.dependencies,
        vulnerabilities: p.vulnerabilities,
      })),
      securityClassification: data.securityClassification,
    };
  }

  deserialize(data: Record<string, unknown>): SystemRegisteredData {
    // Zodスキーマでバリデーションと型変換を実行
    const validated = SystemRegisteredDataSchema.parse(data);

    return {
      systemId: validated.systemId,
      name: validated.name,
      type: validated.type,
      host: {
        cpu: validated.host.cpu,
        memory: validated.host.memory,
        storage: validated.host.storage,
        encryptionEnabled: validated.host.encryptionEnabled,
      },
      criticality: CriticalityLevel.create(validated.criticality),
      packages: validated.packages.map((p) => ({
        name: p.name,
        version: p.version,
        dependencies: p.dependencies,
        vulnerabilities: p.vulnerabilities as VulnerabilityInfo[],
      })),
      securityClassification: validated.securityClassification,
    };
  }
}
