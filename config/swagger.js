import swaggerJsDoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "ERP API Documentation",
      version: "1.0.0",
      description: "Full ERP Backend APIs (Auth + Billing + Ledger + Customer)",
    },
    servers: [
      {
        url:  "https://wiry-staleness-rebate.ngrok-free.dev/api",
      },
    ],

    components: {
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "integer" },
            email: { type: "string" },
            username: { type: "string" },
            role: { type: "string" },
            organizationLevel: { type: "string" },
            storeCode: { type: "string" },
            phoneNumber: { type: "string" },
            storeName: { type: "string" },
            isActive: { type: "boolean" },
          },
        },
        District: {
  type: "object",
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    state_name: { type: "string" },
  },
},

Store: {
  type: "object",
  properties: {
    id: { type: "integer" },
    store_code: { type: "string" },
    store_name: { type: "string" },
    organizationlevel: { type: "string" },
    state: { type: "string" },
    district: { type: "string" },
    district_id: { type: "integer" },
    address: { type: "string" },
    phone_number: { type: "string" },
    is_active: { type: "boolean" },
  },
},

        Customer: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            phone: { type: "string" },
            address: { type: "string" },
            pan_card_number: { type: "string" },
            pincode: { type: "string" },
            store_code: { type: "string" },
          },
        },

        InvoiceItem: {
          type: "object",
          properties: {
            product_code: { type: "string" },
            description: { type: "string" },
            purity: { type: "string" },
            gross_weight: { type: "number" },
            less_weight: { type: "number" },
            net_weight: { type: "number" },
            rate: { type: "number" },
            making_charge_percent: { type: "number" },
            total_amount: { type: "number" },
          },
        },

        Invoice: {
          type: "object",
          properties: {
            invoice_number: { type: "string" },
            total_amount: { type: "number" },
            pending_amount: { type: "number" },
            status: { type: "string" },
          },
        },

        Payment: {
          type: "object",
          properties: {
            invoice_id: { type: "integer" },
            amount: { type: "number" },
            payment_method: { type: "string" },
            financier: { type: "string" },
          },
        },
        
      },
    },
  },
  

  apis: [],
};

const swaggerSpec = swaggerJsDoc(options);

// ========================== PATHS ==========================
swaggerSpec.paths = {

  // ================= AUTH =================
  "/auth/register": {
    post: {
      summary: "Register User (with file upload)",
      tags: ["Auth"],
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              properties: {
                email: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
                role: { type: "string" },
                organizationLevel: { type: "string" },
                storeCode: { type: "string" },
                phoneNumber: { type: "string" },
                storeName: { type: "string" },
                policeDoc: { type: "string", format: "binary" },
                aadhaar: { type: "string", format: "binary" },
                pan: { type: "string", format: "binary" },
              },
            },
          },
        },
      },
      responses: { 201: { description: "User registered" } },
    },
  },

  "/auth/login": {
    post: {
      summary: "Login",
      tags: ["Auth"],
      requestBody: {
        content: {
          "application/json": {
            example: { email: "user@gmail.com", password: "123456" },
          },
        },
      },
      responses: { 200: { description: "JWT Token" } },
    },
  },

  "/auth/forgot-password": {
    post: {
      summary: "Send OTP",
      tags: ["Auth"],
      requestBody: {
        content: {
          "application/json": {
            example: { email: "user@gmail.com" },
          },
        },
      },
      responses: { 200: { description: "OTP sent" } },
    },
  },

  "/auth/verify-otp": {
    post: {
      summary: "Verify OTP",
      tags: ["Auth"],
      requestBody: {
        content: {
          "application/json": {
            example: { email: "user@gmail.com", otp: "123456" },
          },
        },
      },
      responses: { 200: { description: "OTP verified" } },
    },
  },

  "/auth/reset-password": {
    post: {
      summary: "Reset Password",
      tags: ["Auth"],
      requestBody: {
        content: {
          "application/json": {
            example: {
              email: "user@gmail.com",
              otp: "123456",
              newPassword: "new123456",
            },
          },
        },
      },
      responses: { 200: { description: "Password reset success" } },
    },
  },

  // ================= CUSTOMER =================
  "/ledger/customer": {
    post: {
      summary: "Create Customer",
      tags: ["Customer"],
      requestBody: {
        content: {
          "application/json": {
            example: {
              name: "Rahul",
              phone: "9876543210",
              address: "Delhi",
            },
          },
        },
      },
      responses: { 201: { description: "Customer created" } },
    },
  },

  "/ledger/customer/search": {
    get: {
      summary: "Search Customers",
      tags: ["Customer"],
      parameters: [
        { name: "q", in: "query" },
        { name: "with_balance", in: "query" },
      ],
      responses: { 200: { description: "Customer list" } },
    },
  },

  "/ledger/customer/{id}": {
    get: {
      summary: "Get Customer",
      tags: ["Customer"],
      parameters: [{ name: "id", in: "path" }],
      responses: { 200: { description: "Customer detail" } },
    },
  },

  // ================= INVOICE =================
  "/ledger/invoice": {
    post: {
      summary: "Create Invoice",
      tags: ["Invoice"],
      requestBody: {
        content: {
          "application/json": {
            example: {
              customer_id: 1,
              items: [
                {
                  product_code: "GOLD001",
                  gross_weight: 10,
                  rate: 5000,
                },
              ],
            },
          },
        },
      },
      responses: { 201: { description: "Invoice created" } },
    },
  },

  "/ledger/invoice/detail/{invoice_id}": {
    get: {
      summary: "Invoice Detail",
      tags: ["Invoice"],
      parameters: [{ name: "invoice_id", in: "path" }],
      responses: { 200: { description: "Invoice detail" } },
    },
  },

  "/ledger/invoice/customer/{customer_id}": {
    get: {
      summary: "Customer Invoices",
      tags: ["Invoice"],
      parameters: [{ name: "customer_id", in: "path" }],
      responses: { 200: { description: "Invoices list" } },
    },
  },

  "/ledger/invoice/pending": {
    get: {
      summary: "Pending Invoices",
      tags: ["Invoice"],
      responses: { 200: { description: "Pending list" } },
    },
  },

  // ================= PAYMENT =================
  "/ledger/payment": {
    post: {
      summary: "Create Payment",
      tags: ["Payment"],
      requestBody: {
        content: {
          "application/json": {
            example: {
              invoice_id: 1,
              amount: 5000,
              payment_method: "CASH",
            },
          },
        },
      },
      responses: { 200: { description: "Payment success" } },
    },
  },

  "/ledger/payment/invoice/{invoice_id}": {
    get: {
      summary: "Payments by Invoice",
      tags: ["Payment"],
      parameters: [{ name: "invoice_id", in: "path" }],
      responses: { 200: { description: "Payments list" } },
    },
  },

  // ================= LEDGER =================
  "/ledger/ledger": {
    get: {
      summary: "Ledger Summary",
      tags: ["Ledger"],
      parameters: [
        { name: "page", in: "query" },
        { name: "limit", in: "query" },
      ],
      responses: { 200: { description: "Ledger summary" } },
    },
  },

  "/ledger/ledger/customer/{customer_id}": {
    get: {
      summary: "Customer Ledger Detail",
      tags: ["Ledger"],
      parameters: [{ name: "customer_id", in: "path" }],
      responses: { 200: { description: "Ledger detail" } },
    },
  },
  // ================= REPORTS =================

// DASHBOARD SUMMARY
"/reports/summary": {
  get: {
    summary: "Dashboard Summary",
    description: "Get total customers, total revenue, and total sales",
    tags: ["Reports"],
    responses: {
      200: {
        description: "Summary fetched successfully",
        content: {
          "application/json": {
            example: {
              success: true,
              data: {
                totalCustomers: 120,
                totalRevenue: 2500000,
                totalSales: 340,
              },
            },
          },
        },
      },
    },
  },
},

// CASH VS ACCOUNT
"/reports/cash-vs-account": {
  get: {
    summary: "Cash vs Online Payments",
    description: "Get payment distribution (Cash vs Online)",
    tags: ["Reports"],
    responses: {
      200: {
        description: "Payment split",
        content: {
          "application/json": {
            example: {
              success: true,
              data: {
                cash: 150000,
                online: 220000,
              },
            },
          },
        },
      },
    },
  },
},

// CATEGORY SALES
"/reports/category-sales": {
  get: {
    summary: "Category-wise Sales",
    tags: ["Reports"],
    responses: {
      200: {
        description: "Category data",
        content: {
          "application/json": {
            example: {
              success: true,
              data: [
                { category: "Ring", total_items: 120 },
                { category: "Necklace", total_items: 80 },
              ],
            },
          },
        },
      },
    },
  },
},

// TYPE DISTRIBUTION
"/reports/type-distribution": {
  get: {
    summary: "Metal Type Distribution",
    tags: ["Reports"],
    responses: {
      200: {
        description: "Gold vs Silver",
        content: {
          "application/json": {
            example: {
              success: true,
              data: [
                { metal_type: "Gold", count: 200 },
                { metal_type: "Silver", count: 150 },
              ],
            },
          },
        },
      },
    },
  },
},

// TOP PRODUCTS
"/reports/top-products": {
  get: {
    summary: "Top 5 Products by Revenue",
    tags: ["Reports"],
    responses: {
      200: {
        description: "Top selling products",
        content: {
          "application/json": {
            example: {
              success: true,
              data: [
                {
                  item_name: "Gold Ring",
                  category: "Ring",
                  total_revenue: 500000,
                },
              ],
            },
          },
        },
      },
    },
  },
},
// ALL REPORTS (COMBINED DASHBOARD)
"/reports/reports/all": {
  get: {
    summary: "Get Complete Dashboard Data (All Reports)",
    description: "Returns full dashboard including summary, cash vs account, category sales, type distribution and top products",
    tags: ["Reports"],
    responses: {
      200: {
        description: "All dashboard data",
        content: {
          "application/json": {
            example: {
              success: true,
              data: {
                dashboardSummary: {
                  totalCustomers: 120,
                  totalRevenue: 2500000,
                  totalSales: 340
                },
                cashVsAccount: [
                  {
                    date: "2026-04-14",
                    day: "Mon",
                    cash: 5000,
                    online: 10000,
                    total: 15000
                  }
                ],
                categorySales: [
                  { category: "Ring", percentage: 40 },
                  { category: "Necklace", percentage: 60 }
                ],
                typeDistribution: [
                  { label: "Gold 22K", value: 22000 },
                  { label: "Silver 925", value: 28000 }
                ],
                topProducts: [
                  {
                    rank: 1,
                    product_name: "Gold Ring",
                    category: "Ring",
                    units_sold: 10,
                    total_revenue: 50000,
                    performance: 100
                  }
                ]
              }
            }
          }
        }
      }
    }
  }
},
"/reports/reports/filtered": {
  get: {
    summary: "Get Complete Dashboard Data (Store / District / Head Office)",
    description: "Returns dashboard data based on level (store, district, head)",
    tags: ["Reports"],

    parameters: [
      {
        name: "level",
        in: "query",
        required: false,
        schema: {
          type: "string",
          enum: ["store", "district", "head"]
        },
        example: "store",
        description: "Select data level (store / district / head)"
      },
      {
        name: "store_id",
        in: "query",
        required: false,
        schema: { type: "integer" },
        example: 3,
        description: "Required when level = store"
      },
      {
        name: "district_id",
        in: "query",
        required: false,
        schema: { type: "integer" },
        example: 2,
        description: "Required when level = district"
      }
    ],

    responses: {
      200: {
        description: "All dashboard data",
        content: {
          "application/json": {
            example: {
              success: true,
              data: {
                dashboardSummary: {
                  totalCustomers: 120,
                  totalRevenue: 2500000,
                  totalSales: 340
                },
                cashVsAccount: [
                  {
                    date: "2026-04-14",
                    day: "Mon",
                    cash: 5000,
                    online: 10000,
                    total: 15000
                  }
                ],
                categorySales: [
                  { category: "Ring", percentage: 40 },
                  { category: "Necklace", percentage: 60 }
                ],
                typeDistribution: [
                  { label: "Gold 22K", value: 22000 },
                  { label: "Silver 925", value: 28000 }
                ],
                topProducts: [
                  {
                    rank: 1,
                    product_name: "Gold Ring",
                    category: "Ring",
                    units_sold: 10,
                    total_revenue: 50000,
                    performance: 100
                  }
                ]
              }
            }
          }
        }
      }
    }
  }
},
// ================= DISTRICT =================

// CREATE DISTRICT (SuperAdmin Only)
"/districts/create": {
  post: {
    summary: "Create District (SuperAdmin Only)",
    tags: ["District"],
    parameters: [
      {
        name: "role",
        in: "header",
        required: true,
        schema: { type: "string" },
        example: "SuperAdmin",
      },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          example: {
            name: "Noida",
            state_name: "UP",
          },
        },
      },
    },
    responses: {
      201: { description: "District created successfully" },
      403: { description: "Unauthorized (Only SuperAdmin)" },
    },
  },
},
"/reports/reports/filtered": {
  get: {
    summary: "Get Complete Dashboard Data (Store / District / Head Office)",
    description: "Returns dashboard data based on level (store, district, head)",
    tags: ["Reports"],

    parameters: [
      {
        name: "level",
        in: "query",
        required: false,
        schema: {
          type: "string",
          enum: ["store", "district", "head"]
        },
        example: "store",
        description: "Select data level (store / district / head)"
      },
      {
        name: "store_id",
        in: "query",
        required: false,
        schema: { type: "integer" },
        example: 3,
        description: "Required when level = store"
      },
      {
        name: "district_id",
        in: "query",
        required: false,
        schema: { type: "integer" },
        example: 2,
        description: "Required when level = district"
      }
    ],

    responses: {
      200: {
        description: "All dashboard data",
        content: {
          "application/json": {
            example: {
              success: true,
              data: {
                dashboardSummary: {
                  totalCustomers: 120,
                  totalRevenue: 2500000,
                  totalSales: 340
                },
                cashVsAccount: [
                  {
                    date: "2026-04-14",
                    day: "Mon",
                    cash: 5000,
                    online: 10000,
                    total: 15000
                  }
                ],
                categorySales: [
                  { category: "Ring", percentage: 40 },
                  { category: "Necklace", percentage: 60 }
                ],
                typeDistribution: [
                  { label: "Gold 22K", value: 22000 },
                  { label: "Silver 925", value: 28000 }
                ],
                topProducts: [
                  {
                    rank: 1,
                    product_name: "Gold Ring",
                    category: "Ring",
                    units_sold: 10,
                    total_revenue: 50000,
                    performance: 100
                  }
                ]
              }
            }
          }
        }
      }
    }
  }
},

// GET DISTRICTS BY STATE
"/districts/state/{state_name}": {
  get: {
    summary: "Get Districts by State",
    tags: ["District"],
    parameters: [
      {
        name: "state_name",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
    ],
    responses: {
      200: { description: "District list with stores" },
    },
  },
},

// ================= STORE =================

// CREATE STORE
"/stores/register": {
  post: {
    summary: "Create Store (SuperAdmin Only)",
    tags: ["Store"],
    parameters: [
      {
        name: "role",
        in: "header",
        required: true,
        schema: { type: "string" },
        example: "SuperAdmin",
      },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          example: {
            store_code: "STR001",
            store_name: "Noida Store",
            organizationlevel: "Retail",
            state: "UP",
            district: "Noida",
            district_id: 1,
            address: "Sector 18",
            phone_number: "9876543210",
          },
        },
      },
    },
    responses: {
      201: { description: "Store created successfully" },
      400: { description: "Validation error" },
      403: { description: "Unauthorized" },
    },
  },
},

// BULK CREATE STORES
"/stores/bulk": {
  post: {
    summary: "Bulk Create Stores (SuperAdmin Only)",
    tags: ["Store"],
    parameters: [
      {
        name: "role",
        in: "header",
        required: true,
        schema: { type: "string" },
        example: "SuperAdmin",
      },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          example: [
            {
              store_code: "STR002",
              store_name: "Delhi Store",
              district_id: 1,
            },
            {
              store_code: "STR003",
              store_name: "Gurgaon Store",
              district_id: 2,
            },
          ],
        },
      },
    },
    responses: {
      201: { description: "Stores created successfully" },
      400: { description: "Invalid district_id" },
    },
  },
},

// GET STORES BY DISTRICT
"/stores/district/{district_id}": {
  get: {
    summary: "Get Stores by District",
    tags: ["Store"],
    parameters: [
      {
        name: "district_id",
        in: "path",
        required: true,
        schema: { type: "integer" },
      },
    ],
    responses: {
      200: { description: "Stores list" },
    },
  },
},
};



export default swaggerSpec;