import { describe, expect, it } from "vitest";
import {
  conversionPlan,
  groupPhotos,
  localPhotoBase64,
  localPhotoId,
  localPhotoKind,
  mergeLocalPhotos,
  photoKey,
  photoStorageOf,
} from "./photoPaths";

const id = "123e4567-e89b-12d3-a456-426614174000";
const id2 = "223e4567-e89b-12d3-a456-426614174000";
const only = `local:only:${id}:YWJj`;
const both = `local:both:${id}:YWJj`;
const cloud = `u/${id}.jpg`;

describe("photo path formats", () => {
  it("parses only/both and legacy paths", () => {
    expect(localPhotoKind(only)).toBe("only");
    expect(localPhotoKind(both)).toBe("both");
    expect(localPhotoKind(`local:${id}:YWJj`)).toBe("legacy");
    expect(localPhotoKind("local:YWJj")).toBe("legacy");
    expect(localPhotoKind(cloud)).toBeNull();

    expect(localPhotoId(only)).toBe(id);
    expect(localPhotoId(both)).toBe(id);
    expect(localPhotoId(`local:YWJj`)).toBeNull();

    expect(localPhotoBase64(only)).toBe("YWJj");
    expect(localPhotoBase64(both)).toBe("YWJj");
    expect(localPhotoBase64(`local:${id}:YWJj`)).toBe("YWJj");
    expect(localPhotoBase64("local:YWJj")).toBe("YWJj");
  });

  it("pairs a cloud path with its local sibling by uuid", () => {
    expect(photoKey(cloud)).toBe(id);
    expect(photoKey(both)).toBe(id);
    expect(photoKey(only)).toBe(id);
  });
});

describe("groupPhotos", () => {
  it("renders one group per photo", () => {
    const onlyOther = `local:only:${id2}:YWJj`;
    const groups = groupPhotos([cloud, both, onlyOther, `local:YWJj`]);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({ key: id, cloud, local: both });
    expect(photoStorageOf(groups[0])).toBe("both");
    expect(photoStorageOf(groups[1])).toBe("local");
    expect(photoStorageOf(groups[2])).toBe("local");
  });

  it("keeps a cloud-only photo", () => {
    const [g] = groupPhotos([cloud]);
    expect(photoStorageOf(g)).toBe("cloud");
  });
});

describe("mergeLocalPhotos", () => {
  it("keeps local-only and legacy copies across remote updates", () => {
    const legacy = "local:YWJj";
    expect(mergeLocalPhotos([cloud], [only, legacy])).toEqual([cloud, only, legacy]);
  });

  it("keeps a both cache while its cloud sibling exists", () => {
    expect(mergeLocalPhotos([cloud], [both])).toEqual([cloud, both]);
  });

  it("drops a both cache when the photo was deleted remotely", () => {
    expect(mergeLocalPhotos([`u/${id2}.jpg`], [both])).toEqual([`u/${id2}.jpg`]);
  });

  it("does not duplicate an identical local path", () => {
    expect(mergeLocalPhotos([only], [only])).toEqual([only]);
  });
});

describe("conversionPlan", () => {
  it("returns null when the target is unchanged", () => {
    expect(conversionPlan("local", "local")).toBeNull();
    expect(conversionPlan("cloud", "cloud")).toBeNull();
    expect(conversionPlan("both", "both")).toBeNull();
  });

  it("uploads when moving from local to cloud or both", () => {
    expect(conversionPlan("local", "cloud")).toMatchObject({
      upload: true,
      download: false,
      dropLocal: true,
      result: "cloud",
    });
    expect(conversionPlan("local", "both")).toMatchObject({
      upload: true,
      dropLocal: false,
      result: "both",
    });
  });

  it("downloads when moving from cloud to local or both", () => {
    expect(conversionPlan("cloud", "local")).toMatchObject({
      download: true,
      dropCloud: true,
      result: "local",
    });
    expect(conversionPlan("cloud", "both")).toMatchObject({
      download: true,
      dropCloud: false,
      result: "both",
    });
  });

  it("only drops a copy when moving out of both", () => {
    expect(conversionPlan("both", "local")).toMatchObject({
      upload: false,
      download: false,
      dropLocal: false,
      dropCloud: true,
      result: "local",
    });
    expect(conversionPlan("both", "cloud")).toMatchObject({
      dropLocal: true,
      dropCloud: false,
      result: "cloud",
    });
  });
});
