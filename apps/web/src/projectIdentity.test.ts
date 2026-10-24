import { expect, it } from "vite-plus/test";

import { deriveProjectIdentity, projectTintColor } from "./projectIdentity";

it("uses the automatic icon colour when the project has no icon override", () => {
  expect(projectTintColor({ title: "Studio", projectIcon: null })).toBe(
    deriveProjectIdentity("Studio").color,
  );
  expect(projectTintColor({ title: "Studio" })).toBe(deriveProjectIdentity("Studio").color);
});

it("uses the saved colour for monogram and Lucide icons", () => {
  expect(
    projectTintColor({
      title: "Studio",
      projectIcon: { kind: "monogram", text: "ST", color: "teal" },
    }),
  ).toBe("teal");
  expect(
    projectTintColor({
      title: "Studio",
      projectIcon: { kind: "lucide", name: "Palette", color: "violet" },
    }),
  ).toBe("violet");
});

it("uses the automatic colour for an emoji icon", () => {
  expect(projectTintColor({ title: "Studio", projectIcon: { kind: "emoji", emoji: "🎨" } })).toBe(
    deriveProjectIdentity("Studio").color,
  );
});

it("leaves a conversation without a project untinted", () => {
  expect(projectTintColor(null)).toBeUndefined();
  expect(projectTintColor(undefined)).toBeUndefined();
});

it("keeps scratch conversations neutral", () => {
  expect(
    projectTintColor({ title: "No Project", projectIcon: null, isScratch: true }),
  ).toBeUndefined();
});
