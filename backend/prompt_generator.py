"""
Prompt Generator Module
Generates multiple prompts using OpenAI GPT API based on system and user prompts.
"""

import json
import logging
from typing import List, Dict, Any, Optional
from openai import OpenAI
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PromptGenerator:
    """
    A helper class for generating multiple prompts using OpenAI GPT API.

    Attributes:
        api_key (str): OpenAI API key
        model (str): GPT model to use (default: gpt-4)
        temperature (float): Sampling temperature (default: 0.7)
        max_tokens (int): Maximum tokens per response (default: 2000)
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gpt-4",
        temperature: float = 0.7,
        max_tokens: int = 2000
    ):
        """
        Initialize the PromptGenerator.

        Args:
            api_key: OpenAI API key. If None, reads from OPENAI_API_KEY env var
            model: GPT model to use
            temperature: Sampling temperature (0.0 to 2.0)
            max_tokens: Maximum tokens in the response
        """
        self.api_key = api_key or os.environ.get('OPENAI_API_KEY')
        if not self.api_key:
            raise ValueError("OpenAI API key must be provided or set in OPENAI_API_KEY environment variable")

        self.client = OpenAI(api_key=self.api_key)
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens

    def generate_prompts(
        self,
        system_prompt: str,
        user_prompt: str,
        prompt_count: int,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> List[str]:
        """
        Generate multiple prompts using GPT API.

        Args:
            system_prompt: System-level instructions for GPT
            user_prompt: User's input/context for prompt generation
            prompt_count: Number of prompts to generate
            temperature: Override default temperature
            max_tokens: Override default max_tokens

        Returns:
            List of generated prompts as strings

        Raises:
            ValueError: If inputs are invalid
            openai.OpenAIError: If API call fails
        """
        # Validate inputs
        if not system_prompt or not system_prompt.strip():
            raise ValueError("system_prompt cannot be empty")

        if not user_prompt or not user_prompt.strip():
            raise ValueError("user_prompt cannot be empty")

        if prompt_count < 1:
            raise ValueError("prompt_count must be at least 1")

        if prompt_count > 50:
            raise ValueError("prompt_count cannot exceed 50")

        # Use provided values or defaults
        temp = temperature if temperature is not None else self.temperature
        tokens = max_tokens if max_tokens is not None else self.max_tokens

        # Construct the full user message with JSON output instruction
        full_user_message = f"""{user_prompt}

Generate exactly {prompt_count} prompt(s). Return your response as a valid JSON array of strings.
Format: ["prompt 1", "prompt 2", ...]

Each prompt should be detailed, specific, and ready to use for video generation."""

        try:
            logger.info(f"Generating {prompt_count} prompts using {self.model}")

            # Call OpenAI API (try with json_object format first, fall back if not supported)
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": full_user_message}
                    ],
                    temperature=temp,
                    max_tokens=tokens,
                    n=1,
                    response_format={"type": "json_object"}
                )
            except Exception as json_error:
                # If json_object format is not supported, try without it
                logger.warning(f"JSON object format not supported, falling back to text: {json_error}")
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": full_user_message}
                    ],
                    temperature=temp,
                    max_tokens=tokens,
                    n=1
                )

            # Extract response content
            content = response.choices[0].message.content.strip()
            logger.info(f"Received response from GPT: {content[:100]}...")

            # Parse JSON response
            try:
                parsed_response = json.loads(content)

                # Handle different JSON structures
                if isinstance(parsed_response, list):
                    prompts = parsed_response
                elif isinstance(parsed_response, dict):
                    # Try common keys
                    if 'prompts' in parsed_response:
                        prompts = parsed_response['prompts']
                    elif 'episodes' in parsed_response:
                        prompts = parsed_response['episodes']
                    elif 'items' in parsed_response:
                        prompts = parsed_response['items']
                    else:
                        # Take the first list value found
                        prompts = next((v for v in parsed_response.values() if isinstance(v, list)), [])
                else:
                    raise ValueError(f"Unexpected response format: {type(parsed_response)}")

                # Validate prompts
                if not isinstance(prompts, list):
                    raise ValueError("Response does not contain a list of prompts")

                if len(prompts) != prompt_count:
                    logger.warning(
                        f"Expected {prompt_count} prompts, got {len(prompts)}. "
                        f"Adjusting to match requested count."
                    )
                    # Pad or truncate to match expected count
                    if len(prompts) < prompt_count:
                        if len(prompts) > 0:
                            # Pad with last prompt
                            prompts.extend([prompts[-1]] * (prompt_count - len(prompts)))
                        else:
                            # No prompts at all - raise error
                            raise ValueError("No valid prompts generated from response")
                    else:
                        prompts = prompts[:prompt_count]

                # Ensure all prompts are strings
                prompts = [str(p).strip() for p in prompts if p]

                if not prompts:
                    raise ValueError("No valid prompts generated")

                logger.info(f"Successfully generated {len(prompts)} prompts")
                return prompts

            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {e}")
                raise ValueError(f"Invalid JSON response from GPT: {content[:200]}")

        except Exception as e:
            logger.error(f"Error in generate_prompts: {e}")
            raise

    def generate_episode_prompts(
        self,
        outline: str,
        episode_count: int,
        temperature: Optional[float] = None
    ) -> List[str]:
        """
        Generate prompts for short form drama episodes based on an outline.

        This is a convenience method with a pre-configured system prompt
        for film directors creating short form drama episodes.

        Args:
            outline: Story outline or plot summary
            episode_count: Number of episodes to generate prompts for
            temperature: Sampling temperature (optional)

        Returns:
            List of episode prompts
        """
        system_prompt = """You are an expert film director producing a short form drama series.
Your task is to generate detailed, visual prompts for each episode that can be used for
AI video generation. Each prompt should:

1. Be specific and vivid with visual details
2. Include setting, mood, and key actions
3. Be suitable for 8-15 second video clips
4. Follow narrative progression from the outline
5. Maintain consistency with the overall story

Focus on creating cinematic, engaging scenes that work well as short vertical videos."""

        user_prompt = f"""Story Outline:
{outline}

Generate {episode_count} episode prompts based on this outline. Each prompt should describe
a key scene or moment from that episode suitable for short-form video generation."""

        return self.generate_prompts(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            prompt_count=episode_count,
            temperature=temperature
        )


def create_prompt_generator(
    api_key: Optional[str] = None,
    model: str = "gpt-4",
    temperature: float = 0.7
) -> PromptGenerator:
    """
    Factory function to create a PromptGenerator instance.

    Args:
        api_key: OpenAI API key
        model: GPT model to use
        temperature: Sampling temperature

    Returns:
        Configured PromptGenerator instance
    """
    return PromptGenerator(api_key=api_key, model=model, temperature=temperature)
