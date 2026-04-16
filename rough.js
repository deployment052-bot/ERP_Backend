export const createDailyAudit = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const user = req.user;
    const {
      audit_date,
      remark,
      category,
      items = [],
      submit = true,
    } = req.body;

    if (!Array.isArray(items)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Items must be an array",
      });
    }

    if (!category) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    const scope = await getUserScope(user);
    const finalAuditDate = audit_date || getTodayDate();

    const existingAudit = await InventoryAudit.findOne({
      where: {
        organization_id: scope.organization_id,
        audit_date: finalAuditDate,
        audit_type: "daily",
        remark: { [Op.ne]: null },
      },
      transaction: t,
    });

    if (existingAudit) {
      // optional: same day duplicate audit block
      // category-wise audit chahiye to model/table me category field add karo
    }

    const itemWhere = {
      organization_id: scope.organization_id,
      category,
    };

    if (
      scope.organization_level === "retail" &&
      scope.store_code &&
      hasAttr(Item, "storeCode")
    ) {
      itemWhere.storeCode = scope.store_code;
    }

    const dbItems = await Item.findAll({
      where: itemWhere,
      include: [
        {
          model: Stock,
          as: "stocks",
          required: false,
          where: { organization_id: scope.organization_id },
          attributes: ["id", "item_id", "available_qty", "available_weight"],
        },
      ],
      transaction: t,
      order: [["id", "DESC"]],
    });

    if (!dbItems.length) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "No stock items found for this category audit",
      });
    }

    const submittedMap = new Map();

    for (const row of items) {
      const itemId = safeNum(row.item_id, null);
      if (itemId) {
        submittedMap.set(itemId, row);
      }
    }

    const auditHeader = await InventoryAudit.create(
      {
        audit_no: generateAuditNo(scope.organization_id),
        organization_id: scope.organization_id,
        organization_level: scope.organization_level,
        audit_scope: "self",
        audit_date: finalAuditDate,
        audit_type: "daily",
        parent_organization_id: scope.parent_organization_id,
        visible_to_organization_id: scope.visible_to_organization_id,
        store_id: scope.store_id,
        store_code: scope.store_code,
        store_name: scope.store_name,
        district_id: scope.district_id,
        district_code: scope.district_code,
        district_name: scope.district_name,
        total_items: dbItems.length,
        checked_items: 0,
        present_items: 0,
        missing_items: 0,
        pending_items: 0,
        status: submit ? "submitted" : "draft",
        remark: remark || `${category} audit`,
        submitted_at: submit ? new Date() : null,
        created_by: user.id,
      },
      { transaction: t }
    );

    let checked = 0;
    let present = 0;
    let missing = 0;
    let pending = 0;

    for (const dbItem of dbItems) {
      const stock =
        Array.isArray(dbItem.stocks) && dbItem.stocks.length
          ? dbItem.stocks[0]
          : null;

      const submittedRow = submittedMap.get(safeNum(dbItem.id));

      const systemQty = safeNum(stock?.available_qty);
      const systemWeight = safeNum(stock?.available_weight);

      let finalResult = "pending";
      let physicalQty = 0;
      let physicalWeight = 0;
      let checklistNote = null;
      let missingReason = null;
      let isChecked = false;

      if (submittedRow && submittedRow.is_checked === true) {
        isChecked = true;

        const requestedResult = String(
          submittedRow.audit_result || ""
        ).toLowerCase();

        finalResult = ["present", "missing", "mismatch", "extra"].includes(
          requestedResult
        )
          ? requestedResult
          : "present";

        physicalQty =
          submittedRow.physical_qty !== undefined
            ? safeNum(submittedRow.physical_qty)
            : finalResult === "present"
            ? systemQty
            : 0;

        physicalWeight =
          submittedRow.physical_weight !== undefined
            ? safeNum(submittedRow.physical_weight)
            : finalResult === "present"
            ? systemWeight
            : 0;

        checklistNote = submittedRow.checklist_note || submittedRow.note || null;
        missingReason = submittedRow.missing_reason || null;
      } else {
        finalResult = "pending";
        isChecked = false;
        physicalQty = 0;
        physicalWeight = 0;
        checklistNote = "Audit not completed for this item";
      }

      if (isChecked) checked++;
      if (finalResult === "present") present++;
      if (finalResult === "missing") missing++;
      if (finalResult === "pending") pending++;

      const auditItem = await InventoryAuditItem.create(
        {
          audit_id: auditHeader.id,
          item_id: dbItem.id,
          article_code: dbItem.article_code || null,
          sku_code: dbItem.sku_code || null,
          item_name: dbItem.item_name || null,
          metal_type: dbItem.metal_type || null,
          category: dbItem.category || null,
          purity: dbItem.purity || null,

          system_qty: systemQty,
          system_weight: systemWeight,
          physical_qty: physicalQty,
          physical_weight: physicalWeight,

          audit_result: finalResult,
          is_checked: isChecked,
          is_available: finalResult === "present",
          is_matched:
            finalResult === "present" &&
            physicalQty === systemQty &&
            physicalWeight === systemWeight,
          is_missing: finalResult === "missing",
          is_extra: finalResult === "extra",

          variance_qty: Number((physicalQty - systemQty).toFixed(3)),
          variance_weight: Number((physicalWeight - systemWeight).toFixed(3)),

          checklist_note: checklistNote,
          missing_reason: missingReason,
          reason_submitted_at: missingReason ? new Date() : null,
          reason_submitted_by: missingReason ? user.id : null,

          escalation_status:
            finalResult === "missing"
              ? missingReason
                ? "under_review"
                : "reason_pending"
              : finalResult === "pending"
              ? "audit_pending"
              : "none",

          image_url: submittedRow?.image_url || null,
          attachment_url: submittedRow?.attachment_url || null,
        },
        { transaction: t }
      );

      if (finalResult === "missing" && !missingReason) {
        await InventoryAuditFollowup.create(
          {
            audit_id: auditHeader.id,
            audit_item_id: auditItem.id,
            item_id: dbItem.id,
            followup_date: finalAuditDate,
            followup_type: "reason_request",
            status: "open",
            note: "Item marked missing during audit. Reason required.",
            created_by: user.id,
          },
          { transaction: t }
        );
      }

      if (finalResult === "pending") {
        await InventoryAuditFollowup.create(
          {
            audit_id: auditHeader.id,
            audit_item_id: auditItem.id,
            item_id: dbItem.id,
            followup_date: finalAuditDate,
            followup_type: "audit_pending",
            status: "open",
            note: "This item was in stock but audit checkbox was not selected.",
            created_by: user.id,
          },
          { transaction: t }
        );
      }

      await createAuditLog({
        t,
        req,
        module: "inventory_audit_item",
        entity_type: "audit_item",
        entity_id: auditItem.id,
        parent_entity_type: "audit",
        parent_entity_id: auditHeader.id,
        action:
          finalResult === "missing"
            ? "mark_missing"
            : finalResult === "present"
            ? "mark_present"
            : "mark_pending",
        status: finalResult,
        reference_no: auditHeader.audit_no,
        title: "Audit item updated",
        audit_date: finalAuditDate,
        item_id: dbItem.id,
        article_code: dbItem.article_code || null,
        sku_code: dbItem.sku_code || null,
        item_name: dbItem.item_name || null,
        reason: missingReason,
        remarks: checklistNote,
        new_values: auditItem.toJSON(),
        context: {
          ...scope,
          user_id: user.id,
        },
      });
    }

    await auditHeader.update(
      {
        checked_items: checked,
        present_items: present,
        missing_items: missing,
        pending_items: pending,
      },
      { transaction: t }
    );

    await createAuditLog({
      t,
      req,
      module: "inventory_audit",
      entity_type: "audit",
      entity_id: auditHeader.id,
      action: submit ? "submit" : "create",
      status: auditHeader.status,
      reference_no: auditHeader.audit_no,
      title: "Daily inventory audit created",
      audit_date: finalAuditDate,
      remarks: remark || `${category} audit`,
      new_values: auditHeader.toJSON(),
      meta: {
        category,
        total_items: dbItems.length,
        checked,
        present,
        missing,
        pending,
      },
      context: {
        ...scope,
        user_id: user.id,
      },
    });

    await t.commit();

    return res.status(201).json({
      success: true,
      message: "Daily audit submitted successfully",
      data: {
        id: auditHeader.id,
        audit_no: auditHeader.audit_no,
        audit_date: auditHeader.audit_date,
        category,
        organization_id: auditHeader.organization_id,
        organization_level: auditHeader.organization_level,
        total_items: dbItems.length,
        checked_items: checked,
        present_items: present,
        missing_items: missing,
        pending_items: pending,
        status: auditHeader.status,
      },
    });
  } catch (error) {
    await t.rollback();
    console.error("createDailyAudit error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create daily audit",
      error: error.message,
    });
  }
};