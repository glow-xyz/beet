import { Buffer } from "buffer";
import { fixBeetFromData, fixBeetFromValue } from "../beet.fixable";
import {
  assertFixedSizeBeet,
  Beet,
  BEET_PACKAGE,
  BEET_TYPE_ARG_INNER,
  FixableBeet,
  FixedSizeBeet,
  SupportedTypeDefinition,
} from "../types";
import { logTrace } from "../utils";

/**
 * Represents the Rust Option type {@link T}.
 *
 * @template T inner option type
 *
 * @category beet/option
 */
export type COption<T> = T | null;

const NONE = 0;
const SOME = 1;

/**
 * @private
 */
export function isSomeBuffer(buf: Buffer, offset: number) {
  return buf[offset] === SOME;
}

/**
 * @private
 */
export function isNoneBuffer(buf: Buffer, offset: number) {
  return buf[offset] === NONE;
}

/**
 * De/Serializes `None` case of an _Option_ of type {@link T} represented by
 * {@link COption}.
 *
 * The de/serialized type is prefixed with `0`.
 * This matches the `COption::None` type borsh representation.
 *
 * @template T inner option type
 * @param inner the De/Serializer for the inner type
 *
 * @category beet/option
 */
export function coptionNone<T>(description: string): FixedSizeBeet<COption<T>> {
  logTrace(`coptionNone(${description})`);
  return {
    write: function (buf: Buffer, offset: number, value: COption<T>) {
      if (value != null) {
        throw new Error("coptionNone can only handle `null` values");
      }
      buf[offset] = NONE;
    },

    read: function (buf: Buffer, offset: number): COption<T> {
      if (!isNoneBuffer(buf, offset)) {
        throw new Error("coptionNone can only handle `NONE` data");
      }
      return null;
    },

    byteSize: 1,
    description: `COption<None(${description})>`,
  };
}

/**
 * De/Serializes `Some` case of an _Option_ of type {@link T} represented by
 * {@link COption}.
 *
 * The de/serialized type is prefixed with `1`.
 * This matches the `COption::Some` type borsh representation.
 *
 * @template T inner option type
 * @param inner the De/Serializer for the inner type
 *
 * @category beet/composite
 */
export function coptionSome<T>(
  inner: FixedSizeBeet<T>
): FixedSizeBeet<COption<T>> {
  const byteSize = 1 + inner.byteSize;

  const beet = {
    write: function (buf: Buffer, offset: number, value: COption<T>) {
      assertFixedSizeBeet(
        inner,
        `coption inner type ${inner.description} needs to be fixed before calling write`
      );
      if (value == null) {
        throw new Error("coptionSome cannot handle `null` values");
      }
      buf[offset] = SOME;
      inner.write(buf, offset + 1, value);
    },

    read: function (buf: Buffer, offset: number): COption<T> {
      assertFixedSizeBeet(
        inner,
        `coption inner type ${inner.description} needs to be fixed before calling read`
      );
      if (!isSomeBuffer(buf, offset)) {
        throw new Error("coptionSome can only handle `SOME` data");
      }
      return inner.read(buf, offset + 1);
    },

    description: `COption<${inner.description}>[1 + ${inner.byteSize}]`,
    byteSize,

    inner,
  };
  logTrace(beet.description);
  return beet;
}

/**
 * De/Serializes an _Option_ of type {@link T} represented by {@link COption}.
 *
 * The de/serialized type is prefixed with `1` if the inner value is present
 * and with `0` if not.
 * This matches the `COption` type borsh representation.
 *
 * @template T inner option type
 * @param inner the De/Serializer for the inner type
 *
 * @category beet/composite
 */
export function coption<T>(
  inner: Beet<T, T>
): FixableBeet<COption<T>, COption<T>> {
  return {
    toFixedFromData(buf: Buffer, offset: number): FixedSizeBeet<COption<T>> {
      if (isSomeBuffer(buf, offset)) {
        const innerFixed = fixBeetFromData(inner, buf, offset + 1);
        return coptionSome(innerFixed as FixedSizeBeet<T>);
      }

      if (!isNoneBuffer(buf, offset)) {
        throw new Error(`Expected ${buf} to hold a COption`);
      }
      return coptionNone(inner.description);
    },

    toFixedFromValue(
      val: COption<T>
    ): FixedSizeBeet<COption<T>, Partial<COption<T>>> {
      return val == null
        ? coptionNone(inner.description)
        : coptionSome(fixBeetFromValue(inner, val));
    },

    description: `COption<${inner.description}>`,
  };
}

/**
 * @category TypeDefinition
 */
export type CompositesExports = keyof typeof import("./composites");
/**
 * @category TypeDefinition
 */
export type CompositesTypeMapKey = "option";
/**
 * @category TypeDefinition
 */
export type CompositesTypeMap = Record<
  CompositesTypeMapKey,
  SupportedTypeDefinition & { beet: CompositesExports }
>;

/**
 * Maps composite beet exports to metadata which describes in which package it
 * is defined as well as which TypeScript type is used to represent the
 * deserialized value in JavaScript.
 *
 * @category TypeDefinition
 */
export const compositesTypeMap: CompositesTypeMap = {
  option: {
    beet: "coption",
    isFixable: true,
    sourcePack: BEET_PACKAGE,
    ts: "COption<Inner>",
    arg: BEET_TYPE_ARG_INNER,
    pack: BEET_PACKAGE,
  },
};
