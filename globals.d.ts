/** CSS imported with the `?inline` query resolves to the compiled CSS string. */
declare module '*.css?inline' {
  const css: string;
  export default css;
}
