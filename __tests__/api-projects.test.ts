import { NextRequest } from "next/server";
import { POST } from "@/app/api/projects/route";
import { StorageService } from "@/lib/storage";

// Mock the StorageService
jest.mock("@/lib/storage", () => ({
  StorageService: {
    saveProject: jest.fn().mockResolvedValue("mock-id"),
    getProject: jest.fn().mockResolvedValue(null),
  },
}));

describe("POST /api/projects", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should map all custom properties correctly from request body to ProjectData", async () => {
    // 1. Prepare a fake request body that includes all properties
    // we want to ensure are NOT dropped by the POST /api/projects handler.
    const mockBody = {
      id: "req-id-123",
      name: "My Next Great Novel",
      flowType: "with-commentator",
      scriptText: "Once upon a time in a cyberpunk city...",
      segmentSize: 200,
      language: "portuguese",
      style: "Cyberpunk aesthetic, neon lights",
      voice: "CommentatorVoice1",
      consistency: true,
      segments: ["Scene 1", "Scene 2"],
      entities: [
        { name: "John", description: "A cyborg", status: "completed" },
      ],
      commentator: {
        id: "c-1",
        name: "Clyde",
        personality: "Snarky",
        appearance: { type: "generated", imagePrompt: "A robot" },
        voice: "RobotVoice1",
      },
    };

    // 2. Mock a NextRequest
    const req = new NextRequest("http://localhost:3000/api/projects", {
      method: "POST",
      body: JSON.stringify(mockBody),
    });

    // 3. Call the POST handler directly
    const res = await POST(req);
    const jsonResponse: any = await res.json();

    // 4. Assert that the handler responded correctly
    expect(res.status).toBe(200);

    // 5. Assert that StorageService was called with the Correct mapped payload!
    expect(StorageService.saveProject).toHaveBeenCalledTimes(1);
    const calledWithArg = (StorageService.saveProject as jest.Mock).mock
      .calls[0][0];

    expect(calledWithArg).toMatchObject({
      id: "req-id-123",
      name: "My Next Great Novel",
      flowType: "with-commentator",
      scriptText: "Once upon a time in a cyberpunk city...",
      segmentSize: 200,
      language: "portuguese",
      style: "Cyberpunk aesthetic, neon lights",
      voice: "CommentatorVoice1",
      consistency: true,
      segments: ["Scene 1", "Scene 2"],
      entities: [
        { name: "John", description: "A cyborg", status: "completed" },
      ],
    });

    // Specifically test nested missing properties
    expect(calledWithArg.commentator).toBeDefined();
    expect(calledWithArg.commentator.voice).toBe("RobotVoice1");
    expect(calledWithArg.consistency).toBe(true);
    expect(calledWithArg.voice).toBe("CommentatorVoice1");
    expect(calledWithArg.entities.length).toBe(1);
  });

  it("should return 400 if scriptText is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: "missing script" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(StorageService.saveProject).not.toHaveBeenCalled();
  });
});
