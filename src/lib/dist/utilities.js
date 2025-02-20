"use strict";
exports.__esModule = true;
exports.LIFIQueue = exports.dirname = void 0;
var url_1 = require("url");
var path_1 = require("path");
exports.dirname = (function () {
    var __filename = url_1.fileURLToPath(import.meta.url);
    return path_1["default"].dirname(__filename);
});
var ListNode = /** @class */ (function () {
    function ListNode(value) {
        this.next = null;
        this.prev = null;
        this.value = value;
    }
    return ListNode;
}());
var LIFIQueue = /** @class */ (function () {
    function LIFIQueue(n) {
        this.head = null;
        this.tail = null;
        this.reinsertHead = null;
        this.reinsertTail = null;
        this.initializeShuffledQueue(n);
    }
    LIFIQueue.prototype.initializeShuffledQueue = function (n) {
        var numbers = this.shuffleRange(n);
        for (var _i = 0, numbers_1 = numbers; _i < numbers_1.length; _i++) {
            var num = numbers_1[_i];
            this.enqueue(num); // Fill main queue from shuffled list
        }
    };
    LIFIQueue.prototype.shuffleRange = function (n) {
        var _a;
        var array = Array.from({ length: n }, function (_, i) { return i; });
        for (var i = array.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            _a = [array[j], array[i]], array[i] = _a[0], array[j] = _a[1];
        }
        return array;
    };
    // Add to the main queue (shuffled numbers at init)
    LIFIQueue.prototype.enqueue = function (num) {
        var newNode = new ListNode(num);
        if (!this.head) {
            this.head = this.tail = newNode;
        }
        else {
            this.tail.next = newNode;
            newNode.prev = this.tail;
            this.tail = newNode;
        }
    };
    // Pop the next number (either from main queue or reinsert queue)
    LIFIQueue.prototype.getNext = function () {
        if (this.tail) {
            // Get from original shuffled list first (LIFO)
            var value = this.tail.value;
            this.tail = this.tail.prev;
            if (this.tail)
                this.tail.next = null;
            else
                this.head = null;
            return value;
        }
        else if (this.reinsertHead) {
            // Get from reinserts (FIFO order)
            var value = this.reinsertHead.value;
            this.reinsertHead = this.reinsertHead.next;
            if (this.reinsertHead)
                this.reinsertHead.prev = null;
            else
                this.reinsertTail = null;
            return value;
        }
        return undefined; // Empty queue
    };
    // Reinsert a number (FIFO for reinserts)
    LIFIQueue.prototype.reinsert = function (num) {
        var newNode = new ListNode(num);
        if (!this.reinsertHead) {
            this.reinsertHead = this.reinsertTail = newNode;
        }
        else {
            this.reinsertTail.next = newNode;
            newNode.prev = this.reinsertTail;
            this.reinsertTail = newNode;
        }
    };
    return LIFIQueue;
}());
exports.LIFIQueue = LIFIQueue;
