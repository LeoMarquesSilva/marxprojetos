const slugPattern = /^[a-z0-9-]+$/;

export function parseCaptureTargets(inputs, localBaseUrl) {
  if (inputs.length === 0) {
    throw new Error("Provide at least one portfolio capture target.");
  }

  return inputs.map((input) => {
    const separator = input.indexOf("=");
    const slug = separator === -1 ? input : input.slice(0, separator);
    const externalUrl =
      separator === -1 ? null : input.slice(separator + 1);

    if (!slugPattern.test(slug)) {
      throw new Error(`Invalid capture target: ${input}`);
    }

    if (separator !== -1 && !externalUrl) {
      throw new Error(`Invalid capture target: ${input}`);
    }

    if (externalUrl) {
      const url = new URL(externalUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error(`Invalid capture target: ${input}`);
      }
      return { slug, url: url.href };
    }

    return {
      slug,
      url: `${localBaseUrl}/sites/${slug}/index.html`,
    };
  });
}
