import { fileURLToPath } from 'url';
import path from 'path';

export const dirname = (() => {
  const __filename = fileURLToPath(import.meta.url);
  return path.dirname(__filename);
})

class ListNode {
  value: number;
  next: ListNode | null = null;
  prev: ListNode | null = null;
  
  constructor(value: number) {
    this.value = value;
  }
}

/**
 * 
 * Sort of like a modified linked list
 * Initialized with values from a range shuffled into a random order
 * It then allows for popping them out the "front"
 * and pushing additional ones in the back
 * It's purpose is to maintain a random list of all vacant tiles on the map
 * 
 * It's weakness is that, although it starts shuffled
 * the order of the positions pushed retain the order they are pushed in
 * so if there is a pattern to the way they are added,
 * that pattern will eventually surface once all initially shuffled positions are exhausted
 * 
 * This weakness could be addressed if I can create an O(1) method for
 * pushing new values into a random spot in the array.
 * 
 */

export class LIFIQueue {
  private head: ListNode | null = null;
  private tail: ListNode | null = null;
  private reinsertHead: ListNode | null = null;
  private reinsertTail: ListNode | null = null;

  constructor(n: number) {
    this.initializeShuffledQueue(n);
  }

  private initializeShuffledQueue(n: number): void {
    const numbers = this.shuffleRange(n);
    for (const num of numbers) {
      this.enqueue(num); // Fill main queue from shuffled list
    }
  }

  private shuffleRange(n: number): number[] {
    const array = Array.from({ length: n }, (_, i) => i);
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Add to the main queue (shuffled numbers at init)
  private enqueue(num: number): void {
    const newNode = new ListNode(num);
    if (!this.head) {
      this.head = this.tail = newNode;
    } else {
      this.tail!.next = newNode;
      newNode.prev = this.tail;
      this.tail = newNode;
    }
  }

  // Pop the next number (either from main queue or reinsert queue)
  getNext(): number | undefined {
    if (this.tail) {
      // Get from original shuffled list first (LIFO)
      const value = this.tail.value;
      this.tail = this.tail.prev;
      if (this.tail) this.tail.next = null;
      else this.head = null;
      return value;
    } else if (this.reinsertHead) {
      // Get from reinserts (FIFO order)
      const value = this.reinsertHead.value;
      this.reinsertHead = this.reinsertHead.next;
      if (this.reinsertHead) this.reinsertHead.prev = null;
      else this.reinsertTail = null;
      return value;
    }
    return undefined; // Empty queue
  }

  // Reinsert a number (FIFO for reinserts)
  reinsert(num: number): void {
    const newNode = new ListNode(num);
    if (!this.reinsertHead) {
      this.reinsertHead = this.reinsertTail = newNode;
    } else {
      this.reinsertTail!.next = newNode;
      newNode.prev = this.reinsertTail;
      this.reinsertTail = newNode;
    }
  }
}