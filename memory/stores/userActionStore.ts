import { makeObservable, observable, action } from "mobx";

interface UserAction {
  type: string;
  payload: any;
}

interface MouseEventPayload {
  x: number;
  y: number;
  target: EventTarget | null;
}

interface UserState {
  mousePosition: { x: number, y: number };
  mouseDown: boolean;
  keysPressed: Set<string>;
  actionHistory: UserAction[];
}

class UserActionStore {
  @observable users: Map<string, UserState> = new Map();
  @observable maxHistoryLength: number = 10;

  constructor() {
    makeObservable(this);
    this.addAction = this.addAction.bind(this); // Ensure methods are properly bound
  }

  private getUserState(userId: string): UserState {
    if (!this.users.has(userId)) {
      this.users.set(userId, {
        mousePosition: { x: 0, y: 0 },
        mouseDown: false,
        keysPressed: new Set(),
        actionHistory: []
      });
    }
    return this.users.get(userId)!;
  }

  @action
  updateMousePosition(userId: string, x: number, y: number, target: EventTarget | null) {
    const userState = this.getUserState(userId);
    userState.mousePosition = { x, y };
    this.addAction(userId, { type: 'mouseMove', payload: { x, y, target } });
  }

  @action
  setMouseDown(userId: string, isDown: boolean, x: number, y: number, target: EventTarget | null) {
    const userState = this.getUserState(userId);
    userState.mouseDown = isDown;
    this.addAction(userId, { type: 'mouseDown', payload: { isDown, x, y, target } });
  }

  @action
  addKeyPressed(userId: string, key: string) {
    const userState = this.getUserState(userId);
    userState.keysPressed.add(key);
    this.addAction(userId, { type: 'keyDown', payload: key });
  }

  @action
  removeKeyPressed(userId: string, key: string) {
    const userState = this.getUserState(userId);
    userState.keysPressed.delete(key);
    this.addAction(userId, { type: 'keyUp', payload: key });
  }

  @action
  addAction(userId: string, action: UserAction) {
    const userState = this.getUserState(userId);
    userState.actionHistory.push(action);
    if (userState.actionHistory.length > this.maxHistoryLength) {
      userState.actionHistory.shift();
    }
  }

  @action
  undoLastAction(userId: string) {
    const userState = this.getUserState(userId);
    if (userState.actionHistory.length > 0) {
      const lastAction = userState.actionHistory.pop();
      if (!lastAction) {
        return;
      }
      switch (lastAction.type) {
        case 'mouseMove':
          // Handle undo for mouse move (e.g., revert to previous position)
          break;
        case 'mouseDown':
          userState.mouseDown = !lastAction.payload.isDown;
          break;
        case 'keyDown':
          userState.keysPressed.delete(lastAction.payload);
          break;
        case 'keyUp':
          userState.keysPressed.add(lastAction.payload);
          break;
        default:
          break;
      }
    }
  }

  @action
  getUserActions(userId: string): UserAction[] {
    const userState = this.getUserState(userId);
    return userState.actionHistory;
  }

  @action
  clearUserActions(userId: string) {
    const userState = this.getUserState(userId);
    userState.actionHistory = [];
  }

  @action
  getMousePosition(userId: string): { x: number, y: number } {
    const userState = this.getUserState(userId);
    return userState.mousePosition;
  }
}

const userActionStore = new UserActionStore();
export default userActionStore;
