# rabbitmq-dead-letter-loop

```
        +----------+
        |          |
        v          |
    +-------+  +---+--+
    | clock |  | tick |
    +---+---+  +------+
        |          ^
        |          |
        +----------+
        |
        v
    +----------+
    | consumer |
    +----------+
```
