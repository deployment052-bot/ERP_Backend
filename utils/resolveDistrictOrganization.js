import Store from "../model/Store";

export const resolveDistrictOrganization = async (user) => {
  if (!user) {
    throw new Error("User not authenticated");
  }

  const level = String(user.organization_level || "").toLowerCase();

  if (level !== "district") {
    throw new Error("User is not a district user");
  }

  // Case 1: token.organization_id already points to district office row
  let districtOrg = await Store.findOne({
    where: {
      id: user.organization_id,
      organization_level: "District",
    },
    raw: true,
  });

  if (districtOrg) return districtOrg;

  // Case 2: token.organization_id is actually district_id
  districtOrg = await Store.findOne({
    where: {
      district_id: user.organization_id,
      organization_level: "District",
    },
    order: [["id", "ASC"]],
    raw: true,
  });

  if (districtOrg) return districtOrg;

  // Case 3: fallback by store_code from token
  if (user.store_code) {
    districtOrg = await Store.findOne({
      where: {
        store_code: user.store_code,
        organization_level: "District",
      },
      raw: true,
    });

    if (districtOrg) return districtOrg;
  }

  throw new Error("District office organization not found for logged in user");
};