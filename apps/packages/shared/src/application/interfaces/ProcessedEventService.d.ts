export interface ProcessedEventService {
    isProcessed(eventId: string): Promise<boolean>;
    markAsProcessed(eventId: string, eventType: string, processedAt: Date): Promise<void>;
}
