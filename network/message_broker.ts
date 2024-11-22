// Add message type definitions
interface P2PMessage {
  type: string;
  data?: any;
  peerId?: string;
  targetPeerId?: string;
  leaderId?: string;
}

type MessageHandler = (message: P2PMessage, peerId: string) => void;
type BroadcastHandler = (message: P2PMessage) => void;

class MessageBroker {
  private static instance: MessageBroker | null = null;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private broadcastHandler: BroadcastHandler | null = null;

  private constructor() {}

  static getInstance(): MessageBroker {
    if (!MessageBroker.instance) {
      MessageBroker.instance = new MessageBroker();
    }
    return MessageBroker.instance;
  }

  setBroadcastHandler(handler: BroadcastHandler): void {
    this.broadcastHandler = handler;
  }

  broadcast(message: P2PMessage): void {
    if (this.broadcastHandler) {
      this.broadcastHandler(message);
    }
  }

  subscribe(messageType: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)?.push(handler);
  }

  publish(messageType: string, message: P2PMessage, peerId: string): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      handlers.forEach(handler => handler(message, peerId));
    }
  }
}

// Create and export the singleton instance
const messageBroker = MessageBroker.getInstance();
export { messageBroker, type P2PMessage }; 