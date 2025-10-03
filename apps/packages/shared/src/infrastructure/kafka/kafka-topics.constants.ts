/**
 * Kafka Topic Constants
 *
 * Centralized topic name definitions to prevent typos and ensure type safety.
 * All Kafka topic references should use these constants instead of string literals.
 */

/**
 * Available Kafka topics in the system
 */
export const KAFKA_TOPICS = {
  SYSTEM_EVENTS: 'system-events',
  VULNERABILITY_EVENTS: 'vulnerability-events',
  TASK_EVENTS: 'task-events',
  SECURITY_EVENTS: 'security-events',
} as const;

/**
 * Type-safe topic name type
 */
export type KafkaTopicName = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

/**
 * All topic names as an array (useful for admin/initialization)
 */
export const ALL_KAFKA_TOPICS: readonly KafkaTopicName[] =
  Object.values(KAFKA_TOPICS);
