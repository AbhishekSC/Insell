import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Handshake,
  Home,
  Landmark,
  MapPin,
  Sparkles,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";

const INTENT_OPTIONS = [
  { role: "Buyer", title: "Buy Property", listingIntent: "Buy", icon: Home },
  { role: "Seller", title: "Sell Property", listingIntent: "Sell", icon: Landmark },
  { role: "Tenant", title: "Rent a Property", listingIntent: "Rent", icon: Building2 },
  { role: "Landlord", title: "List Property for Rent", listingIntent: "Lease", icon: Building2 },
  { role: "Broker", title: "I'm a Broker", listingIntent: "Broker", icon: Handshake },
];

const PROPERTY_TYPE_OPTIONS = [
  "Apartment",
  "Independent House",
  "Villa",
  "Plot",
  "Commercial",
  "Agricultural Land",
];

const LOCALITY_OPTIONS = [
  "City Center",
  "West End",
  "Airport Road",
  "Vijay Nagar",
  "New Town",
  "Sector 62",
  "Whitefield",
  "Gachibowli",
];

const BROKER_CATEGORY_OPTIONS = ["Residential", "Commercial", "Agricultural"];
const PREFERRED_LANGUAGE_OPTIONS = ["English", "Hindi"];
const TENANT_PREFERENCE_OPTIONS = ["Family", "Bachelor", "Students", "Company Lease"];

function getStepsByRole(role) {
  if (role === "Buyer") {
    return [
      {
        title: "Basic Profile",
        fields: [
          { name: "fullName", label: "Full name", type: "text", required: true, placeholder: "Your full name" },
          { name: "mobileNumber", label: "Mobile number", type: "text", required: true, placeholder: "10-digit mobile" },
          { name: "preferredLanguage", label: "Preferred language", type: "select", options: PREFERRED_LANGUAGE_OPTIONS },
          { name: "profilePic", label: "Profile picture", type: "file", required: false },
        ],
      },
      {
        title: "Location",
        fields: [
          { name: "city", label: "City", type: "text", required: true, placeholder: "Current city" },
          { name: "location", label: "Location", type: "location", required: false },
        ],
      },
      {
        title: "Property Preferences",
        fields: [
          { name: "propertyTypes", label: "Property types", type: "multi", required: true, options: PROPERTY_TYPE_OPTIONS },
        ],
      },
      {
        title: "Budget",
        fields: [
          { name: "budgetMin", label: "Minimum budget (INR)", type: "number", required: true, placeholder: "2500000" },
          { name: "budgetMax", label: "Maximum budget (INR)", type: "number", required: true, placeholder: "10000000" },
        ],
      },
      {
        title: "Location",
        fields: [
          { name: "preferredCity", label: "Preferred city", type: "text", required: true, placeholder: "Indore" },
          { name: "preferredAreas", label: "Preferred areas", type: "multi", options: LOCALITY_OPTIONS },
          { name: "radiusKm", label: "Radius (km)", type: "number", placeholder: "10" },
          { name: "mapSelection", label: "Map selection note", type: "text", placeholder: "e.g. Vijay Nagar to Bypass stretch" },
        ],
      },
      {
        title: "Requirements",
        fields: [
          { name: "bedrooms", label: "Bedrooms", type: "number", placeholder: "2" },
          { name: "bathrooms", label: "Bathrooms", type: "number", placeholder: "2" },
          { name: "parking", label: "Parking needed", type: "boolean" },
          { name: "readyToMove", label: "Ready to move", type: "boolean" },
          { name: "underConstruction", label: "Under construction", type: "boolean" },
          { name: "loanRequired", label: "Loan required", type: "boolean" },
        ],
      },
    ];
  }

  if (role === "Seller") {
    return [
      {
        title: "Basic Profile",
        fields: [
          { name: "fullName", label: "Full name", type: "text", required: true, placeholder: "Your full name" },
          { name: "mobileNumber", label: "Mobile number", type: "text", required: true, placeholder: "10-digit mobile" },
          { name: "profilePic", label: "Profile picture", type: "file", required: false },
        ],
      },
      {
        title: "Location",
        fields: [
          { name: "city", label: "City", type: "text", required: true, placeholder: "Current city" },
          { name: "location", label: "Location", type: "location", required: false },
        ],
      },
      {
        title: "What are you selling?",
        fields: [
          { name: "propertyTypes", label: "Property category", type: "multi", required: true, options: PROPERTY_TYPE_OPTIONS },
        ],
      },
      {
        title: "Property Details",
        fields: [
          { name: "areaSqft", label: "Area (sqft)", type: "number", placeholder: "1200" },
          { name: "bedrooms", label: "Bedrooms", type: "number", placeholder: "3" },
          { name: "bathrooms", label: "Bathrooms", type: "number", placeholder: "2" },
          { name: "parking", label: "Parking available", type: "boolean" },
          { name: "facing", label: "Facing", type: "text", placeholder: "East" },
          { name: "propertyAgeYears", label: "Age (years)", type: "number", placeholder: "4" },
          { name: "ownershipType", label: "Ownership", type: "text", placeholder: "Freehold" },
        ],
      },
      {
        title: "Upload",
        fields: [
          { name: "photoUrls", label: "Photo URLs (comma separated)", type: "text", placeholder: "https://..." },
          { name: "videoUrl", label: "Video URL", type: "url", placeholder: "https://..." },
          { name: "docUrls", label: "Document URLs (optional)", type: "text", placeholder: "https://..." },
        ],
      },
      {
        title: "Location",
        fields: [
          { name: "mapAddress", label: "Map address", type: "text", required: true, placeholder: "Street / Landmark" },
          { name: "pinCode", label: "Pin code", type: "text", placeholder: "452001" },
        ],
      },
      {
        title: "Price",
        fields: [
          { name: "sellingPrice", label: "Selling price (INR)", type: "number", required: true, placeholder: "7500000" },
          { name: "negotiable", label: "Negotiable", type: "boolean" },
          { name: "expectedPossession", label: "Expected possession", type: "date" },
        ],
      },
    ];
  }

  if (role === "Broker") {
    return [
      {
        title: "Basic Details",
        fields: [
          { name: "fullName", label: "Full name", type: "text", required: true, placeholder: "Your full name" },
          { name: "mobileNumber", label: "Mobile number", type: "text", required: true, placeholder: "10-digit mobile" },
          { name: "profilePic", label: "Profile picture", type: "file", required: false },
        ],
      },
      {
        title: "Location",
        fields: [
          { name: "city", label: "City", type: "text", required: true, placeholder: "Primary city" },
          { name: "location", label: "Location", type: "location", required: false },
        ],
      },
      {
        title: "Business Details",
        fields: [
          { name: "company", label: "Company", type: "text", placeholder: "Agency name" },
          { name: "experienceYears", label: "Experience (years)", type: "number", placeholder: "5" },
          { name: "reraNumber", label: "RERA number", type: "text", required: true, placeholder: "RERA12345" },
          { name: "officeAddress", label: "Office address", type: "text", placeholder: "Office address" },
        ],
      },
      {
        title: "Areas of Operation",
        fields: [
          { name: "operatingCities", label: "Operating cities", type: "multi", required: true, options: ["Indore", "Ratlam", "Ujjain", "Bhopal", "Pune"] },
          { name: "brokerCategories", label: "Property categories", type: "multi", required: true, options: BROKER_CATEGORY_OPTIONS },
        ],
      },
      {
        title: "Verification",
        fields: [
          { name: "govtIdUrl", label: "Government ID URL", type: "url", placeholder: "https://..." },
          { name: "reraDocUrl", label: "RERA doc URL", type: "url", placeholder: "https://..." },
          { name: "gstNumber", label: "GST number", type: "text", placeholder: "GSTIN" },
          { name: "gstDocUrl", label: "GST doc URL", type: "url", placeholder: "https://..." },
          { name: "companyLogoUrl", label: "Company logo URL", type: "url", placeholder: "https://..." },
        ],
      },
    ];
  }

  if (role === "Tenant") {
    return [
      {
        title: "Basic Profile",
        fields: [
          { name: "fullName", label: "Full name", type: "text", required: true, placeholder: "Your full name" },
          { name: "mobileNumber", label: "Mobile number", type: "text", required: true, placeholder: "10-digit mobile" },
          { name: "profilePic", label: "Profile picture", type: "file", required: false },
        ],
      },
      {
        title: "Location",
        fields: [
          { name: "city", label: "City", type: "text", required: true, placeholder: "Current city" },
          { name: "location", label: "Location", type: "location", required: false },
        ],
      },
      {
        title: "Rent Requirements",
        fields: [
          { name: "monthlyRent", label: "Monthly rent budget (INR)", type: "number", required: true, placeholder: "25000" },
          { name: "moveInDate", label: "Move-in date", type: "date", required: true },
          { name: "familyType", label: "Family/Bachelor", type: "select", options: ["Family", "Bachelor", "Either"] },
          { name: "petsAllowed", label: "Pets", type: "boolean" },
          { name: "furnished", label: "Furnished", type: "boolean" },
          { name: "leaseDuration", label: "Lease duration (months)", type: "number", placeholder: "11" },
          { name: "preferredAreas", label: "Preferred localities", type: "multi", options: LOCALITY_OPTIONS },
        ],
      },
    ];
  }

  return [
    {
      title: "Basic Profile",
      fields: [
        { name: "fullName", label: "Full name", type: "text", required: true, placeholder: "Your full name" },
        { name: "mobileNumber", label: "Mobile number", type: "text", required: true, placeholder: "10-digit mobile" },
        { name: "profilePic", label: "Profile picture", type: "file", required: false },
      ],
    },
    {
      title: "Location",
      fields: [
        { name: "city", label: "City", type: "text", required: true, placeholder: "Current city" },
        { name: "location", label: "Location", type: "location", required: false },
      ],
    },
    {
      title: "Listing Type",
      fields: [
        { name: "propertyTypes", label: "Property category", type: "multi", required: true, options: PROPERTY_TYPE_OPTIONS },
      ],
    },
    {
      title: "Rental Terms",
      fields: [
        { name: "monthlyRent", label: "Monthly rent (INR)", type: "number", required: true, placeholder: "30000" },
        { name: "deposit", label: "Security deposit (INR)", type: "number", required: true, placeholder: "60000" },
        { name: "availableFrom", label: "Available from", type: "date" },
        { name: "tenantPreference", label: "Tenant preference", type: "select", options: TENANT_PREFERENCE_OPTIONS },
        { name: "petsAllowed", label: "Pets allowed", type: "boolean" },
        { name: "furnished", label: "Furnished", type: "boolean" },
      ],
    },
  ];
}

function normalizeRoleProfile(role, data) {
  const profile = {
    preferredCity: data.preferredCity || "",
    preferredAreas: data.preferredAreas || [],
    radiusKm: Number(data.radiusKm || 0),
    requirements: {
      bedrooms: Number(data.bedrooms || 0),
      bathrooms: Number(data.bathrooms || 0),
      parking: Boolean(data.parking),
      readyToMove: Boolean(data.readyToMove),
      underConstruction: Boolean(data.underConstruction),
      loanRequired: Boolean(data.loanRequired),
    },
    sellerListing: {
      areaSqft: Number(data.areaSqft || 0),
      facing: data.facing || "",
      propertyAgeYears: Number(data.propertyAgeYears || 0),
      ownershipType: data.ownershipType || "",
      mapAddress: data.mapAddress || "",
      pinCode: data.pinCode || "",
      sellingPrice: Number(data.sellingPrice || 0),
      negotiable: Boolean(data.negotiable),
      expectedPossession: data.expectedPossession || "",
      photoUrls: data.photoUrls ? data.photoUrls.split(",").map((v) => v.trim()).filter(Boolean) : [],
      videoUrl: data.videoUrl || "",
      docUrls: data.docUrls ? data.docUrls.split(",").map((v) => v.trim()).filter(Boolean) : [],
    },
    broker: {
      company: data.company || "",
      experienceYears: Number(data.experienceYears || 0),
      reraNumber: data.reraNumber || "",
      gstNumber: data.gstNumber || "",
      officeAddress: data.officeAddress || "",
      operatingCities: data.operatingCities || [],
      brokerCategories: data.brokerCategories || [],
      govtIdUrl: data.govtIdUrl || "",
      reraDocUrl: data.reraDocUrl || "",
      gstDocUrl: data.gstDocUrl || "",
      companyLogoUrl: data.companyLogoUrl || "",
    },
    rental: {
      monthlyRent: Number(data.monthlyRent || 0),
      moveInDate: data.moveInDate || "",
      familyType: data.familyType || "",
      leaseDuration: Number(data.leaseDuration || 0),
      deposit: Number(data.deposit || 0),
      availableFrom: data.availableFrom || "",
      tenantPreference: data.tenantPreference || "",
      furnished: Boolean(data.furnished),
      petsAllowed: Boolean(data.petsAllowed),
    },
  };

  return { [String(role || "").toLowerCase()]: profile };
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    fullName: "",
    bio: "",
    mobileNumber: "",
    preferredLanguage: "English",
    city: "",
    primaryRole: "",
    activeRole: "",
    userRoles: [],
    propertyTypes: [],
    preferredLocalities: [],
    budgetMin: "",
    budgetMax: "",
    listingIntent: "Buy",
    profilePic: "",
    profilePicFile: null,
    preferredCity: "",
    preferredAreas: [],
    radiusKm: "",
    mapSelection: "",
    latitude: null,
    longitude: null,
    bedrooms: "",
    bathrooms: "",
    parking: false,
    readyToMove: false,
    underConstruction: false,
    loanRequired: false,
    areaSqft: "",
    facing: "",
    propertyAgeYears: "",
    ownershipType: "",
    photoUrls: "",
    videoUrl: "",
    docUrls: "",
    mapAddress: "",
    pinCode: "",
    sellingPrice: "",
    negotiable: false,
    expectedPossession: "",
    company: "",
    experienceYears: "",
    reraNumber: "",
    gstNumber: "",
    officeAddress: "",
    operatingCities: [],
    brokerCategories: [],
    govtIdUrl: "",
    reraDocUrl: "",
    gstDocUrl: "",
    companyLogoUrl: "",
    monthlyRent: "",
    moveInDate: "",
    familyType: "",
    petsAllowed: false,
    furnished: false,
    leaseDuration: "",
    deposit: "",
    availableFrom: "",
    tenantPreference: "",
  });
  const [stepIndex, setStepIndex] = useState(0);

  const selectedIntent = useMemo(
    () => INTENT_OPTIONS.find((item) => item.role === formData.activeRole),
    [formData.activeRole]
  );
  const steps = useMemo(() => getStepsByRole(formData.activeRole), [formData.activeRole]);
  const currentStep = steps[stepIndex] || null;
  const progressValue = steps.length > 0 ? Math.round(((stepIndex + 1) / steps.length) * 100) : 0;

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const activeRole = formData.activeRole || formData.primaryRole;
      const propertyTypePreferences = formData.propertyTypes;
      const preferredLocalities = formData.preferredAreas.length > 0
        ? formData.preferredAreas
        : formData.preferredLocalities;
      const resolvedCity = formData.city || formData.preferredCity;

      // Handle profile picture upload if file is present
      let profilePicUrl = formData.profilePic;
      if (formData.profilePicFile) {
        const formDataUpload = new FormData();
        formDataUpload.append('profilePic', formData.profilePicFile);
        try {
          const uploadResponse = await axiosInstance.post('/upload/profile', formDataUpload, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          profilePicUrl = uploadResponse.data?.url || profilePicUrl;
        } catch (error) {
          console.error('Profile upload failed:', error);
          toast.error('Failed to upload profile picture');
        }
      }

      const payload = {
        fullName: formData.fullName,
        bio: formData.bio,
        mobileNumber: formData.mobileNumber,
        preferredLanguage: formData.preferredLanguage,
        city: resolvedCity,
        profilePic: profilePicUrl,
        latitude: formData.latitude,
        longitude: formData.longitude,
        primaryRole: activeRole,
        activeRole,
        userRoles: activeRole ? [activeRole] : [],
        listingIntent: formData.listingIntent,
        propertyTypePreferences,
        preferredLocalities,
        budgetMin: Number(formData.budgetMin || 0),
        budgetMax: Number(formData.budgetMax || formData.sellingPrice || formData.monthlyRent || 0),
        roleProfiles: normalizeRoleProfile(activeRole, formData),
        // Legacy compatibility fields
        location: resolvedCity,
        homeBase: resolvedCity,
        travelStyle: activeRole,
        travelInterests: propertyTypePreferences,
        favoriteDestinations: preferredLocalities,
        learningLanguage: activeRole,
        nativeLanguage: propertyTypePreferences?.[0] || "",
      };
      const response = await axiosInstance.post("/auth/profile-setup", payload);
      return response.data;
    },
    onSuccess: (response) => {
      toast.success("Profile setup completed");
      queryClient.setQueryData(["authUser"], {
        status: "success",
        data: {
          user: response?.data?.user,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Onboarding failed");
    },
  });

  const { mutate: logoutAndSwitch, isPending: isSwitchingAccount } = useMutation({
    mutationFn: async () => {
      try {
        await axiosInstance.post("/auth/logout");
      } catch (error) {
        if (error?.response?.status !== 401) {
          throw error;
        }
      }
    },
    onSuccess: () => {
      // setQueryData already clears the cache; invalidating on top of that would
      // just trigger a pointless extra /auth/verify call that returns 401.
      queryClient.setQueryData(["authUser"], null);
      navigate("/login?switchAccount=1", { replace: true });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to switch account right now");
    },
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleListValue = (field, value) => {
    setFormData((prev) => {
      const list = Array.isArray(prev[field]) ? prev[field] : [];
      return {
        ...prev,
        [field]: list.includes(value)
          ? list.filter((item) => item !== value)
          : [...list, value],
      };
    });
  };

  const setBooleanField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: Boolean(value) }));
  };

  const handleLocationCapture = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // Reverse geocode to get city/locality
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
            .then(res => res.json())
            .then(data => {
              const city = data.address.city || data.address.town || data.address.village || "";
              setFormData(prev => ({
                ...prev,
                city: prev.city || city,
                preferredCity: prev.preferredCity || city,
                latitude,
                longitude
              }));
              toast.success("Location captured successfully");
            })
            .catch(() => {
              setFormData(prev => ({ ...prev, latitude, longitude }));
              toast.success("Coordinates captured (city/locality not found)");
            });
        },
        () => {
          toast.error("Failed to get location. Please allow location access.");
        }
      );
    } else {
      toast.error("Geolocation is not supported by your browser");
    }
  };

  const handleProfilePicUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error("Please select an image file");
        return;
      }
      setFormData(prev => ({ ...prev, profilePicFile: file, profilePic: URL.createObjectURL(file) }));
    }
  };

  const clearLocation = () => {
    setFormData(prev => ({ ...prev, latitude: null, longitude: null }));
  };

  const isStepValid = (step) => {
    if (!step) return false;

    for (const field of step.fields) {
      if (!field.required) continue;
      const value = formData[field.name];
      if (Array.isArray(value) && value.length === 0) return false;
      if (!Array.isArray(value) && String(value || "").trim() === "") return false;
    }

    return true;
  };

  const handleNextStep = () => {
    if (!currentStep) return;

    if (!isStepValid(currentStep)) {
      toast.error("Please complete required fields before continuing.");
      return;
    }

    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBackStep = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const selectIntent = (intent) => {
    setFormData((prev) => ({
      ...prev,
      primaryRole: intent.role,
      activeRole: intent.role,
      userRoles: [intent.role],
      listingIntent: intent.listingIntent,
    }));
    setStepIndex(0);
  };

  const renderField = (field) => {
    if (field.type === "multi") {
      const list = formData[field.name] || [];
      return (
        <label key={field.name} className="form-control md:col-span-2">
          <span className="label-text mb-1">{field.label}{field.required ? " *" : ""}</span>
          <div className="flex flex-wrap gap-2">
            {(field.options || []).map((option) => {
              const selected = list.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  className={`btn btn-xs ${selected ? "btn-primary" : "btn-outline"}`}
                  onClick={() => toggleListValue(field.name, option)}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </label>
      );
    }

    if (field.type === "boolean") {
      const value = Boolean(formData[field.name]);
      return (
        <label key={field.name} className="form-control">
          <span className="label-text mb-1">{field.label}</span>
          <div className="join">
            <button
              type="button"
              className={`btn join-item btn-sm ${value ? "btn-primary" : "btn-outline"}`}
              onClick={() => setBooleanField(field.name, true)}
            >
              Yes
            </button>
            <button
              type="button"
              className={`btn join-item btn-sm ${!value ? "btn-primary" : "btn-outline"}`}
              onClick={() => setBooleanField(field.name, false)}
            >
              No
            </button>
          </div>
        </label>
      );
    }

    if (field.type === "select") {
      return (
        <label key={field.name} className="form-control">
          <span className="label-text mb-1">{field.label}{field.required ? " *" : ""}</span>
          <select
            className="select select-bordered"
            name={field.name}
            value={formData[field.name] || ""}
            onChange={handleChange}
          >
            <option value="">Select option</option>
            {(field.options || []).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      );
    }

    if (field.type === "file") {
      return (
        <label key={field.name} className="form-control">
          <span className="label-text mb-1">{field.label}{field.required ? " *" : ""}</span>
          <input
            type="file"
            accept="image/*"
            className="file-input file-input-bordered w-full"
            onChange={handleProfilePicUpload}
          />
          {formData.profilePic && (
            <div className="mt-2 flex items-center gap-2">
              <img src={formData.profilePic} alt="Preview" className="size-16 rounded-lg object-cover" />
              <button
                type="button"
                className="btn btn-xs btn-ghost text-error"
                onClick={() => setFormData(prev => ({ ...prev, profilePic: "", profilePicFile: null }))}
              >
                <X className="size-4" />
              </button>
            </div>
          )}
        </label>
      );
    }

    if (field.type === "location") {
      return (
        <label key={field.name} className="form-control">
          <span className="label-text mb-1">{field.label}{field.required ? " *" : ""}</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-sm border border-base-300 bg-base-100 text-base-content hover:bg-base-200"
              onClick={handleLocationCapture}
            >
              <MapPin className="size-4" />
              Use My Current Location
            </button>
          </div>
          {formData.latitude && formData.longitude && (
            <div className="mt-2 flex items-center gap-2 text-xs text-base-content/60">
              <MapPin className="size-3" />
              <span>Coordinates: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}</span>
              <button
                type="button"
                className="text-error hover:text-error"
                onClick={clearLocation}
              >
                Clear
              </button>
            </div>
          )}
        </label>
      );
    }

    const inputType = field.type === "date" ? "date" : field.type === "number" ? "number" : field.type === "url" ? "url" : "text";
    return (
      <label key={field.name} className="form-control">
        <span className="label-text mb-1">{field.label}{field.required ? " *" : ""}</span>
        <input
          type={inputType}
          name={field.name}
          className="input input-bordered"
          placeholder={field.placeholder || ""}
          value={formData[field.name] || ""}
          onChange={handleChange}
          min={field.type === "number" ? "0" : undefined}
        />
      </label>
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isStepValid(currentStep)) {
      toast.error("Please complete required fields before finishing.");
      return;
    }
    mutate();
  };

  if (!selectedIntent) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_10%_20%,hsl(var(--p)/0.18),transparent_35%),radial-gradient(circle_at_90%_10%,hsl(var(--s)/0.18),transparent_40%),linear-gradient(180deg,hsl(var(--b2)),hsl(var(--b1)))] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <section className="glass-wrap p-6 sm:p-8">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={isSwitchingAccount}
                onClick={() => logoutAndSwitch()}
              >
                {isSwitchingAccount ? "Switching..." : "Use different account"}
              </button>

              <div className="mx-auto text-center sm:mx-0 sm:flex-1">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="size-4" />
                Welcome to NearMySpace
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">What brings you here today?</h1>
              <p className="mt-2 text-sm text-base-content/70 sm:text-base">Choose your intent. We will personalize onboarding instantly.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {INTENT_OPTIONS.map((intent) => {
                const Icon = intent.icon;
                return (
                  <button
                    key={intent.role}
                    type="button"
                    className="rounded-2xl border border-base-300 bg-base-100 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40"
                    onClick={() => selectIntent(intent)}
                  >
                    <div className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <p className="mt-3 text-lg font-bold">{intent.title}</p>
                    <p className="mt-1 text-sm text-base-content/65">Role: {intent.role}</p>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_20%,hsl(var(--p)/0.18),transparent_35%),radial-gradient(circle_at_90%_10%,hsl(var(--s)/0.18),transparent_40%),linear-gradient(180deg,hsl(var(--b2)),hsl(var(--b1)))] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <section className="glass-wrap p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="size-4" />
                Intent-based onboarding
              </div>
              <h1 className="text-3xl font-black tracking-tight">{selectedIntent.title}</h1>
              <p className="mt-1 text-sm text-base-content/70">Step {stepIndex + 1} of {steps.length}: {currentStep?.title}</p>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setFormData((prev) => ({ ...prev, primaryRole: "", activeRole: "", userRoles: [] }));
                setStepIndex(0);
              }}
            >
              Change intent
            </button>

            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={isSwitchingAccount}
              onClick={() => logoutAndSwitch()}
            >
              {isSwitchingAccount ? "Switching..." : "Use different account"}
            </button>
          </div>

          <progress className="progress progress-primary w-full" value={progressValue} max="100" />

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
            {currentStep?.fields?.map((field) => renderField(field))}

            <label className="form-control md:col-span-2">
              <span className="label-text mb-1">Short bio (optional)</span>
              <textarea
                name="bio"
                className="textarea textarea-bordered min-h-24"
                placeholder="Write one line about your property goals"
                value={formData.bio}
                onChange={handleChange}
              />
            </label>

            <label className="form-control md:col-span-2">
              <span className="label-text mb-1">Profile image URL (optional)</span>
              <input
                type="url"
                name="profilePic"
                className="input input-bordered"
                placeholder="https://..."
                value={formData.profilePic}
                onChange={handleChange}
              />
            </label>

            <div className="md:col-span-2 mt-2 flex flex-wrap items-center justify-between gap-2">
              <button type="button" className="btn btn-ghost" disabled={stepIndex === 0} onClick={handleBackStep}>
                <ChevronLeft className="size-4" />
                Back
              </button>

              {stepIndex < steps.length - 1 ? (
                <button type="button" className="btn btn-primary" onClick={handleNextStep}>
                  Next
                  <ChevronRight className="size-4" />
                </button>
              ) : (
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending ? "Saving profile..." : "Finish onboarding"}
                </button>
              )}
            </div>
          </form>

          {stepIndex === steps.length - 1 ? (
            <div className="mt-6 rounded-2xl border border-success/30 bg-success/10 p-4 text-sm">
              <p className="inline-flex items-center gap-2 font-semibold text-success"><CheckCircle2 className="size-4" /> Great! We will now personalize your feed.</p>
            </div>
          ) : null}
        </section>

        <section className="mt-5 rounded-2xl border border-base-300 bg-base-100 p-5">
          <p className="text-sm font-semibold">Why this works</p>
          <ul className="mt-2 space-y-2 text-sm text-base-content/70">
            <li>Only 2-3 focused questions per screen.</li>
            <li>Onboarding adapts to your role and intent.</li>
            <li>The app can switch role later without creating a new account.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
