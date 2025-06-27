import { makeAutoObservable } from "mobx";

class ChatStore {
  messages = [];

  constructor() {
    makeAutoObservable(this);
  }

  addMessage(message) {
    this.messages.push(message);
  }

  setMessages(messages) {
    this.messages = messages;
  }
}

export const chatStore = new ChatStore();