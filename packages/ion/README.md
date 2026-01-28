

# `ION`

`ION` - Isomorphic Object Notation

## Purpose

`ION` is a `JSON` like object serialization format. If given the following code:

```ts
function isomorphicSerialize(obj: any) {
    const serialized = ION.stringify(obj);
    const deserialized = ION.parse(obj);
}
```

It guarantees that either:
- `ION.stringify` throws an error
- `deserialized` and `obj` are identical objects


`JSON` fails in various circumstances at this:
- `Date`s become strings
- `undefined` becomes null
- `Symbol`s are omitted 
- `NaN`, `Infinity`, and `-Infinity` become null
- Sets and maps become `{}`

In cases where something can't be perfectly recreated from parsing, ION will throw an error.


## Syntax


`ION` is a superset of `JSON`. Any valid `JSON` is valid `ION`, although not all objects are translated exactly the same.


```ion
{
    "string": "hello",
    "number": 123,
    "array": [
        {
            "name": null,
            "boolean": true,
        }
    ]
}
```

`JSON` has support for several types: `boolean`, `number`, `string`, `object`, and `array`. `ION` adds a couple more:
- `Infinity`
- `-Infinity`
- `NaN`
- `Date`
- `Map`
- `Set`

Note: `WeakMap` and `WeakSet` cannot be serialized and will throw an error if encountered.


If an object has any `undefined` properties, they are simply omitted. These advanced properties look like:

```ion
{
    "date": date:2026-01-27T15:30:00Z,
    "not-a-number": NaN,
    "infinity": Infinity,
    "negativeInf": -Infinity,
    "someMap": map {
        "property": 1,
        "another": 2
    },
    "someSet": set {
        "a",
        "b"
    }
}
```



